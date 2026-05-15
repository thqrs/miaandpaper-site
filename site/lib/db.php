<?php
/**
 * lib/db.php — SQLITE_INFRA_V1
 *
 * Camada de acesso única à base SQLite privada do site Mia & Paper.
 * - Ficheiro: ../private/miaandpaper.sqlite (paralelo ao public root)
 * - PDO SQLite com prepared statements e ERRMODE_EXCEPTION
 * - PRAGMA foreign_keys=ON, busy_timeout=5000ms, tenta journal_mode=WAL
 * - Migrations idempotentes (CREATE TABLE IF NOT EXISTS) registadas em
 *   `schema_migrations` para historico simples.
 *
 * Sem dependências externas (Composer não é necessário).
 *
 * API principal:
 *   mp_db()                               — devolve PDO singleton
 *   mp_db_private_dir()                   — caminho da pasta privada
 *   mp_db_now()                           — timestamp ISO 8601 UTC
 *   mp_db_insert_order($fields)           — insere encomenda + devolve id
 *   mp_db_log_order_event($oid, $type, $data=null)
 *   mp_db_log_funnel_event($fields)
 *   mp_db_log_admin_login_attempt($fields)
 *   mp_db_log_email($fields)              — id da linha ou false
 *   mp_db_find_open_order($name, $contact, $ip)
 *
 * Convenções:
 *   - Todos os timestamps em UTC ISO ("YYYY-MM-DDTHH:MM:SSZ").
 *   - Valores monetários em cêntimos (INTEGER).
 *   - JSON serializado com JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES.
 */

if (!defined('MIAANDPAPER_DB_LOADED')) {
    define('MIAANDPAPER_DB_LOADED', true);

    /**
     * Caminho absoluto para a pasta privada (paralela ao public root).
     * Cria-a se não existir. Devolve null se falhar (em produção isto
     * deve corresponder a /home/<user>/private/).
     */
    function mp_db_private_dir()
    {
        $dir = __DIR__ . '/../../private';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        return is_dir($dir) ? $dir : null;
    }

    function mp_db_path()
    {
        $dir = mp_db_private_dir();
        if ($dir === null) {
            return null;
        }
        return $dir . '/miaandpaper.sqlite';
    }

    function mp_db_now()
    {
        return gmdate('Y-m-d\TH:i:s\Z');
    }

    /**
     * Singleton PDO. Lança PDOException se SQLite indisponível ou se
     * a pasta privada não puder ser criada.
     */
    function mp_db()
    {
        static $pdo = null;
        if ($pdo instanceof PDO) {
            return $pdo;
        }

        $path = mp_db_path();
        if ($path === null) {
            throw new RuntimeException('Não foi possível criar a pasta privada para a base de dados.');
        }

        $dsn = 'sqlite:' . $path;
        $pdo = new PDO($dsn, null, null, array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ));

        // PRAGMAs obrigatórios.
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA busy_timeout = 5000');

        // WAL preferido mas optional: alguns hostings com NFS rejeitam.
        try {
            $pdo->exec("PRAGMA journal_mode = WAL");
        } catch (Exception $e) {
            /* mantém modo default — DELETE — se WAL não disponível */
        }

        mp_db_migrate($pdo);

        // Permissões restritas no ficheiro (best-effort).
        @chmod($path, 0600);

        return $pdo;
    }

    /**
     * Migrations idempotentes. Cada migration tem id estável (string).
     * Para alterar schema futuro, adicionar nova entry com novo id e
     * SQL aditivo (ALTER TABLE).
     */
    function mp_db_migrate(PDO $pdo)
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )");

        $migrations = array(
            '2026-05-11_init_orders' => "CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_code TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'site',
                product_slug TEXT,
                product_type TEXT,
                customer_name TEXT,
                customer_contact TEXT,
                contact_email TEXT,
                contact_phone TEXT,
                card_name TEXT,
                card_contact TEXT,
                congregation TEXT,
                delivery_option TEXT,
                delivery_label TEXT,
                subtotal_cents INTEGER,
                shipping_estimate_cents INTEGER,
                total_estimate_cents INTEGER,
                currency TEXT DEFAULT 'EUR',
                payment_status TEXT DEFAULT 'unpaid',
                paid INTEGER DEFAULT 0,
                paid_at TEXT,
                fulfillment_status TEXT DEFAULT 'new',
                shipped_at TEXT,
                tracking_number TEXT,
                admin_notes TEXT,
                ip_number TEXT,
                ip_prefix TEXT,
                ip_hash TEXT,
                device_type TEXT,
                viewport_width INTEGER,
                landing_page TEXT,
                referrer TEXT,
                raw_order_json TEXT NOT NULL
            )",
            '2026-05-11_init_order_events' => "CREATE TABLE IF NOT EXISTS order_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data_json TEXT,
                FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
            )",
            '2026-05-11_init_funnel_events' => "CREATE TABLE IF NOT EXISTS funnel_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                session_id TEXT,
                product_slug TEXT,
                product_type TEXT,
                event_name TEXT,
                step_id TEXT,
                step_index INTEGER,
                device_type TEXT,
                viewport_width INTEGER,
                viewport_height INTEGER,
                screen_width INTEGER,
                screen_height INTEGER,
                device_pixel_ratio REAL,
                orientation TEXT,
                ip_number TEXT,
                event_json TEXT NOT NULL
            )",
            '2026-05-11_init_admin_login_attempts' => "CREATE TABLE IF NOT EXISTS admin_login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                ip_number TEXT,
                user_agent TEXT,
                attempt_type TEXT,
                input_text TEXT
            )",
            '2026-05-11_init_email_log' => "CREATE TABLE IF NOT EXISTS email_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                created_at TEXT NOT NULL,
                email_type TEXT,
                recipient TEXT,
                subject TEXT,
                success INTEGER,
                error_message TEXT,
                FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
            )",
            '2026-05-11_idx_orders' => "CREATE INDEX IF NOT EXISTS idx_orders_status_created
                ON orders (fulfillment_status, created_at DESC)",
            '2026-05-11_idx_orders_contact' => "CREATE INDEX IF NOT EXISTS idx_orders_contact
                ON orders (customer_contact, customer_name)",
            '2026-05-11_idx_orders_ip' => "CREATE INDEX IF NOT EXISTS idx_orders_ip
                ON orders (ip_number)",
            '2026-05-11_idx_funnel_session' => "CREATE INDEX IF NOT EXISTS idx_funnel_session
                ON funnel_events (session_id, created_at)",
            '2026-05-11_idx_funnel_event' => "CREATE INDEX IF NOT EXISTS idx_funnel_event
                ON funnel_events (event_name, created_at)",
            '2026-05-11_idx_funnel_product' => "CREATE INDEX IF NOT EXISTS idx_funnel_product
                ON funnel_events (product_slug, created_at)",
            // TRACKING_IGNORE_AND_ARCHIVE_V1 + FUNNEL_RATE_LIMIT_V1
            '2026-05-11_init_tracking_ignore_ips' => "CREATE TABLE IF NOT EXISTS tracking_ignore_ips (
                ip TEXT PRIMARY KEY,
                label TEXT,
                created_at TEXT NOT NULL
            )",
            '2026-05-11_init_funnel_events_archive' => "CREATE TABLE IF NOT EXISTS funnel_events_archive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archived_at TEXT NOT NULL,
                archive_reason TEXT,
                original_id INTEGER,
                created_at TEXT NOT NULL,
                session_id TEXT,
                product_slug TEXT,
                product_type TEXT,
                event_name TEXT,
                step_id TEXT,
                step_index INTEGER,
                device_type TEXT,
                viewport_width INTEGER,
                viewport_height INTEGER,
                screen_width INTEGER,
                screen_height INTEGER,
                device_pixel_ratio REAL,
                orientation TEXT,
                ip_number TEXT,
                event_json TEXT NOT NULL
            )",
            '2026-05-11_idx_funnel_ip_created' => "CREATE INDEX IF NOT EXISTS idx_funnel_ip_created
                ON funnel_events (ip_number, created_at)",
            '2026-05-11_idx_funnel_archive_ip' => "CREATE INDEX IF NOT EXISTS idx_funnel_archive_ip
                ON funnel_events_archive (ip_number, created_at)",
            '2026-05-12_seed_tracking_ignore_ips_launch' => "INSERT OR IGNORE INTO tracking_ignore_ips (ip, label, created_at)
                SELECT '87.196.73.252', 'Pré-lançamento / testes', strftime('%Y-%m-%dT%H:%M:%SZ','now') UNION ALL
                SELECT '95.95.31.28', 'Pré-lançamento / testes', strftime('%Y-%m-%dT%H:%M:%SZ','now') UNION ALL
                SELECT '2.82.21.110', 'Pré-lançamento / testes', strftime('%Y-%m-%dT%H:%M:%SZ','now') UNION ALL
                SELECT '87.196.74.23', 'Pré-lançamento / testes', strftime('%Y-%m-%dT%H:%M:%SZ','now')",
        );

        $check = $pdo->prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
        $insert = $pdo->prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");

        foreach ($migrations as $id => $sql) {
            $check->execute(array($id));
            if ($check->fetch()) {
                continue;
            }
            $pdo->exec($sql);
            $insert->execute(array($id, mp_db_now()));
        }
    }

    /**
     * Insere uma encomenda em transação. $fields é um array associativo
     * com as chaves correspondentes às colunas (subset permitido).
     * Devolve o id inteiro da linha inserida. Lança em caso de falha.
     */
    function mp_db_insert_order(array $fields)
    {
        $allowed = array(
            'order_code', 'created_at', 'updated_at', 'source',
            'product_slug', 'product_type',
            'customer_name', 'customer_contact', 'contact_email', 'contact_phone',
            'card_name', 'card_contact', 'congregation',
            'delivery_option', 'delivery_label',
            'subtotal_cents', 'shipping_estimate_cents', 'total_estimate_cents', 'currency',
            'payment_status', 'paid', 'paid_at',
            'fulfillment_status', 'shipped_at', 'tracking_number', 'admin_notes',
            'ip_number', 'ip_prefix', 'ip_hash',
            'device_type', 'viewport_width', 'landing_page', 'referrer',
            'raw_order_json',
        );

        $values = array();
        foreach ($allowed as $col) {
            if (array_key_exists($col, $fields)) {
                $values[$col] = $fields[$col];
            }
        }

        if (empty($values['order_code']) || empty($values['raw_order_json'])) {
            throw new InvalidArgumentException('order_code e raw_order_json são obrigatórios.');
        }

        $now = mp_db_now();
        if (empty($values['created_at'])) $values['created_at'] = $now;
        if (empty($values['updated_at'])) $values['updated_at'] = $now;
        if (empty($values['source']))     $values['source']     = 'site';

        $pdo = mp_db();
        $pdo->beginTransaction();
        try {
            $cols = array_keys($values);
            $placeholders = array_fill(0, count($cols), '?');
            $sql = 'INSERT INTO orders (' . implode(',', $cols) . ') VALUES (' . implode(',', $placeholders) . ')';
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_values($values));
            $id = (int)$pdo->lastInsertId();
            $pdo->commit();
            return $id;
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    function mp_db_log_order_event($orderId, $eventType, $eventData = null)
    {
        $orderId = (int)$orderId;
        if ($orderId <= 0 || $eventType === '') {
            return false;
        }
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare("INSERT INTO order_events (order_id, created_at, event_type, event_data_json) VALUES (?, ?, ?, ?)");
            $json = $eventData === null ? null : json_encode($eventData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $stmt->execute(array($orderId, mp_db_now(), (string)$eventType, $json));
            return (int)$pdo->lastInsertId();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_log_order_event falhou: ' . $e->getMessage());
            return false;
        }
    }

    function mp_db_log_funnel_event(array $fields)
    {
        $allowed = array(
            'created_at', 'session_id', 'product_slug', 'product_type',
            'event_name', 'step_id', 'step_index',
            'device_type', 'viewport_width', 'viewport_height',
            'screen_width', 'screen_height', 'device_pixel_ratio', 'orientation',
            'ip_number', 'event_json',
        );

        $values = array();
        foreach ($allowed as $col) {
            if (array_key_exists($col, $fields)) {
                $values[$col] = $fields[$col];
            }
        }

        if (empty($values['created_at']))  $values['created_at'] = mp_db_now();
        if (empty($values['event_json']))  $values['event_json'] = '{}';

        try {
            $pdo = mp_db();
            $cols = array_keys($values);
            $placeholders = array_fill(0, count($cols), '?');
            $sql = 'INSERT INTO funnel_events (' . implode(',', $cols) . ') VALUES (' . implode(',', $placeholders) . ')';
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_values($values));
            return (int)$pdo->lastInsertId();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_log_funnel_event falhou: ' . $e->getMessage());
            return false;
        }
    }

    function mp_db_log_admin_login_attempt(array $fields)
    {
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare("INSERT INTO admin_login_attempts (created_at, ip_number, user_agent, attempt_type, input_text) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute(array(
                isset($fields['created_at']) ? $fields['created_at'] : mp_db_now(),
                isset($fields['ip_number']) ? (string)$fields['ip_number'] : null,
                isset($fields['user_agent']) ? (string)$fields['user_agent'] : null,
                isset($fields['attempt_type']) ? (string)$fields['attempt_type'] : null,
                isset($fields['input_text']) ? (string)$fields['input_text'] : null,
            ));
            return (int)$pdo->lastInsertId();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_log_admin_login_attempt falhou: ' . $e->getMessage());
            return false;
        }
    }

    function mp_db_log_email(array $fields)
    {
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare("INSERT INTO email_log (order_id, created_at, email_type, recipient, subject, success, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute(array(
                isset($fields['order_id']) ? (int)$fields['order_id'] : null,
                isset($fields['created_at']) ? $fields['created_at'] : mp_db_now(),
                isset($fields['email_type']) ? (string)$fields['email_type'] : null,
                isset($fields['recipient']) ? (string)$fields['recipient'] : null,
                isset($fields['subject']) ? (string)$fields['subject'] : null,
                isset($fields['success']) ? ((int)$fields['success'] ? 1 : 0) : 0,
                isset($fields['error_message']) ? (string)$fields['error_message'] : null,
            ));
            return (int)$pdo->lastInsertId();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_log_email falhou: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Normaliza um valor de comparação: lower-case + colapso de espaços
     * + trim. Usado para o matching de nome e contacto na detecção de
     * encomenda aberta (Fase 3).
     */
    function mp_db_normalize($value)
    {
        $value = (string)$value;
        $value = strtolower($value);
        $value = preg_replace('/\s+/u', ' ', $value);
        return trim((string)$value);
    }

    /**
     * Tenta encontrar uma encomenda aberta (new/preparing) do mesmo
     * nome+contacto+IP. Devolve a linha ou null. Não devolve detalhes
     * sensíveis para o cliente — chamadores devem reduzir a um boolean
     * antes de devolver via endpoint público.
     */
    function mp_db_find_open_order($customerName, $customerContact, $ipNumber)
    {
        $normalizedName = mp_db_normalize($customerName);
        $normalizedContact = mp_db_normalize($customerContact);
        if ($normalizedName === '' || $normalizedContact === '') {
            return null;
        }
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare(
                "SELECT * FROM orders
                 WHERE LOWER(TRIM(customer_name)) = ?
                   AND LOWER(TRIM(customer_contact)) = ?
                   AND (ip_number = ? OR ip_number IS NULL OR ? = '')
                   AND fulfillment_status IN ('new', 'preparing')
                 ORDER BY created_at DESC
                 LIMIT 1"
            );
            $stmt->execute(array($normalizedName, $normalizedContact, (string)$ipNumber, (string)$ipNumber));
            $row = $stmt->fetch();
            return $row ?: null;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_find_open_order falhou: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * SHORT_ORDER_CODE_V1
     * Gera order_code no formato MP-YYYYMM<seq>, em que <seq> é a próxima
     * sequência inteira do mês corrente (UTC). Exemplos:
     *   1ª encomenda de Maio/2026 → MP-2026051
     *   21ª encomenda de Maio/2026 → MP-20260521
     *   1ª encomenda de Junho/2026 → MP-2026061
     *
     * A sequência é calculada via MAX(<seq>) das encomendas existentes com
     * o mesmo prefixo, +1. Isto garante monotonicidade dentro do mês mesmo
     * que existam gaps (encomendas canceladas / códigos legados com sufixos).
     *
     * Em caso de colisão por concorrência (duas chamadas a obter o mesmo
     * MAX antes do INSERT), itera até 20 candidatos consecutivos antes de
     * desistir. Fallback final adiciona "-X" com letra/dígito para garantir
     * unicidade. order_code é UNIQUE → o INSERT vai sempre falhar em
     * empate, e o caller deve apanhar a excepção e re-gerar.
     */
    function mp_db_generate_order_code()
    {
        $pdo = mp_db();
        $prefix = 'MP-' . gmdate('Ym'); // ex: MP-202605

        // Lê o último código com este prefixo e extrai a parte numérica
        // inicial do sufixo. Suporta sufixos legados com hífen ("-XY").
        $stmt = $pdo->prepare(
            "SELECT order_code FROM orders
             WHERE order_code LIKE ?
             ORDER BY id DESC
             LIMIT 1"
        );
        $stmt->execute(array($prefix . '%'));
        $last = $stmt->fetchColumn();

        $next = 1;
        if ($last !== false && $last !== null) {
            $suffix = substr((string)$last, strlen($prefix));
            if (preg_match('/^(\d+)/', $suffix, $m)) {
                $next = ((int)$m[1]) + 1;
            }
        }

        $check = $pdo->prepare("SELECT 1 FROM orders WHERE order_code = ? LIMIT 1");
        for ($i = 0; $i < 20; $i++) {
            $candidate = $prefix . ($next + $i);
            $check->execute(array($candidate));
            if (!$check->fetch()) {
                return $candidate;
            }
        }

        // Fallback (improvável): sufixo curto para garantir unicidade.
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($i = 0; $i < 10; $i++) {
            $candidate = $prefix . ($next) . '-' . $alphabet[random_int(0, strlen($alphabet) - 1)] . $alphabet[random_int(0, strlen($alphabet) - 1)];
            $check->execute(array($candidate));
            if (!$check->fetch()) {
                return $candidate;
            }
        }

        return $prefix . $next . '-' . substr(uniqid('', true), -3);
    }

    // ----- TRACKING_IGNORE_AND_ARCHIVE_V1 -----

    /**
     * Sanitiza um IP para uso em queries. Aceita IPv4 e IPv6 literal,
     * devolve string vazia se não for válido (assim evita-se erros
     * silenciosos com input do admin).
     */
    function mp_db_normalize_ip($value)
    {
        $value = trim((string)$value);
        if ($value === '') return '';
        if (filter_var($value, FILTER_VALIDATE_IP)) return $value;
        return '';
    }

    /**
     * Parse de uma lista de IPs (textarea / vírgula-separada). Devolve
     * array único de IPs válidos.
     */
    function mp_db_parse_ip_list($raw)
    {
        $raw = (string)$raw;
        $parts = preg_split('/[\s,;]+/u', $raw);
        $out = array();
        foreach ($parts as $p) {
            $clean = mp_db_normalize_ip($p);
            if ($clean !== '' && !in_array($clean, $out, true)) {
                $out[] = $clean;
            }
        }
        return $out;
    }

    function mp_db_list_ignored_ips()
    {
        try {
            $pdo = mp_db();
            $stmt = $pdo->query('SELECT ip, label, created_at FROM tracking_ignore_ips ORDER BY created_at DESC');
            return $stmt ? $stmt->fetchAll() : array();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_list_ignored_ips falhou: ' . $e->getMessage());
            return array();
        }
    }

    function mp_db_is_ip_ignored($ip, $invalidate = false)
    {
        static $cache = array();
        if ($invalidate) {
            $cache = array();
            return false;
        }
        $ip = (string)$ip;
        if ($ip === '') return false;
        if (array_key_exists($ip, $cache)) return $cache[$ip];
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare('SELECT 1 FROM tracking_ignore_ips WHERE ip = ? LIMIT 1');
            $stmt->execute(array($ip));
            $cache[$ip] = (bool)$stmt->fetchColumn();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_is_ip_ignored falhou: ' . $e->getMessage());
            $cache[$ip] = false;
        }
        return $cache[$ip];
    }

    /**
     * Adiciona um IP à ignore list. Idempotente (INSERT OR IGNORE).
     * Devolve true se efectivamente adicionou, false se já existia ou
     * falhou.
     */
    function mp_db_add_ignored_ip($ip, $label = '')
    {
        $ip = mp_db_normalize_ip($ip);
        if ($ip === '') return false;
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare('INSERT OR IGNORE INTO tracking_ignore_ips (ip, label, created_at) VALUES (?, ?, ?)');
            $stmt->execute(array($ip, (string)$label, mp_db_now()));
            mp_db_is_ip_ignored('', true); // invalida cache do request
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_add_ignored_ip falhou: ' . $e->getMessage());
            return false;
        }
    }

    function mp_db_remove_ignored_ip($ip)
    {
        $ip = mp_db_normalize_ip($ip);
        if ($ip === '') return false;
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare('DELETE FROM tracking_ignore_ips WHERE ip = ?');
            $stmt->execute(array($ip));
            mp_db_is_ip_ignored('', true); // invalida cache do request
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_remove_ignored_ip falhou: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Move eventos do funil dos IPs fornecidos para funnel_events_archive
     * e apaga-os de funnel_events. Tudo numa transação. Devolve número
     * de linhas arquivadas, ou -1 em caso de erro.
     */
    function mp_db_archive_funnel_events_by_ips(array $ips, $reason = 'test_data')
    {
        $ips = array_values(array_filter(array_map('mp_db_normalize_ip', $ips), 'strlen'));
        if (empty($ips)) return 0;
        $placeholders = implode(',', array_fill(0, count($ips), '?'));

        $pdo = mp_db();
        $pdo->beginTransaction();
        try {
            $archivedAt = mp_db_now();
            $insertSql = 'INSERT INTO funnel_events_archive (
                archived_at, archive_reason, original_id,
                created_at, session_id, product_slug, product_type, event_name,
                step_id, step_index, device_type,
                viewport_width, viewport_height, screen_width, screen_height,
                device_pixel_ratio, orientation, ip_number, event_json
            ) SELECT
                ?, ?, id,
                created_at, session_id, product_slug, product_type, event_name,
                step_id, step_index, device_type,
                viewport_width, viewport_height, screen_width, screen_height,
                device_pixel_ratio, orientation, ip_number, event_json
            FROM funnel_events WHERE ip_number IN (' . $placeholders . ')';

            $stmtInsert = $pdo->prepare($insertSql);
            $stmtInsert->execute(array_merge(array($archivedAt, (string)$reason), $ips));
            $archived = $stmtInsert->rowCount();

            $stmtDelete = $pdo->prepare('DELETE FROM funnel_events WHERE ip_number IN (' . $placeholders . ')');
            $stmtDelete->execute($ips);

            $pdo->commit();
            return $archived;
        } catch (Exception $e) {
            $pdo->rollBack();
            @error_log('[miaandpaper] mp_db_archive_funnel_events_by_ips falhou: ' . $e->getMessage());
            return -1;
        }
    }

    /**
     * FUNNEL_RATE_LIMIT_V1: conta eventos recentes de um IP. Usa o índice
     * idx_funnel_ip_created. Devolve int (>=0).
     */
    function mp_db_count_recent_funnel_events($ip, $sinceIsoUtc)
    {
        $ip = (string)$ip;
        if ($ip === '') return 0;
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM funnel_events WHERE ip_number = ? AND created_at >= ?');
            $stmt->execute(array($ip, (string)$sinceIsoUtc));
            return (int)$stmt->fetchColumn();
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_db_count_recent_funnel_events falhou: ' . $e->getMessage());
            return 0;
        }
    }

    // ----- TRACKING_CLIENT_IP_V1 -----
    //
    // O site corre em cPanel partilhado e pode estar atrás de Cloudflare ou
    // de um reverse proxy local. Nesses cenários, $_SERVER['REMOTE_ADDR']
    // apresenta o IP do proxy (ex.: edge da Cloudflare) e todos os visitantes
    // aparecem com o mesmo IP — o que partia a ignore list e o rate limit.
    //
    // mp_tracking_client_ip() é a fonte única de verdade do IP "efectivo" do
    // visitante. Conservadora por defeito: REMOTE_ADDR a não ser que haja um
    // sinal forte de proxy. Só usa headers de proxy quando seguro:
    //   - CF-Connecting-IP é populado pela Cloudflare e dificilmente spoofável
    //     se houver Cloudflare à frente (e nós já vemos o REMOTE_ADDR do edge);
    //   - X-Real-IP / X-Forwarded-For só quando REMOTE_ADDR for privado ou
    //     loopback, indicando reverse proxy local.
    //   - HTTP_CLIENT_IP é trivial de spoofar; só fallback final, e ainda assim
    //     mantemos REMOTE_ADDR à frente quando não há outro sinal.

    function mp_tracking_ip_is_public($ip)
    {
        $ip = (string)$ip;
        if ($ip === '') return false;
        return (bool)filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }

    function mp_tracking_ip_is_private($ip)
    {
        $ip = (string)$ip;
        if ($ip === '') return false;
        if (!filter_var($ip, FILTER_VALIDATE_IP)) return false;
        return !mp_tracking_ip_is_public($ip);
    }

    /**
     * Recolhe os headers brutos relevantes para diagnóstico. Não decide
     * nada — só observa. Útil para mostrar ao admin "qual é cada coisa".
     */
    function mp_tracking_collect_raw_ip_headers()
    {
        $keys = array(
            'REMOTE_ADDR',
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_REAL_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_CLIENT_IP',
        );
        $out = array();
        foreach ($keys as $k) {
            $out[$k] = isset($_SERVER[$k]) ? trim((string)$_SERVER[$k]) : '';
        }
        return $out;
    }

    /**
     * Devolve o IP efectivo do cliente. Cacheado por request.
     * Devolve sempre string (eventualmente "" se nada for validável).
     */
    function mp_tracking_client_ip()
    {
        static $cached = null;
        if ($cached !== null) return $cached;

        $headers = mp_tracking_collect_raw_ip_headers();
        $remote = $headers['REMOTE_ADDR'];

        // Cloudflare: o header só existe quando o request passou pelo edge.
        // Se for um IP público válido, usa-o (preferimos sobre o IP do edge).
        if (mp_tracking_ip_is_public($headers['HTTP_CF_CONNECTING_IP'])) {
            return $cached = $headers['HTTP_CF_CONNECTING_IP'];
        }

        // X-Real-IP / X-Forwarded-For: só seguros quando REMOTE_ADDR é
        // privado/loopback (i.e., há um proxy na frente da nossa origem).
        if (mp_tracking_ip_is_private($remote) || $remote === '') {
            if (mp_tracking_ip_is_public($headers['HTTP_X_REAL_IP'])) {
                return $cached = $headers['HTTP_X_REAL_IP'];
            }
            if ($headers['HTTP_X_FORWARDED_FOR'] !== '') {
                foreach (explode(',', $headers['HTTP_X_FORWARDED_FOR']) as $part) {
                    $candidate = trim((string)$part);
                    if (mp_tracking_ip_is_public($candidate)) {
                        return $cached = $candidate;
                    }
                }
            }
            if (mp_tracking_ip_is_public($headers['HTTP_CLIENT_IP'])) {
                return $cached = $headers['HTTP_CLIENT_IP'];
            }
        }

        // Default: REMOTE_ADDR validado (se inválido devolve "").
        if (filter_var($remote, FILTER_VALIDATE_IP)) {
            return $cached = $remote;
        }
        return $cached = '';
    }

    /**
     * Diagnóstico do IP detectado: devolve array com IP efectivo, IP usado
     * em cada header, e uma flag `suspicious` quando há indício de proxy
     * (REMOTE_ADDR privado ou diferente do CF-Connecting-IP). Pensado para
     * mostrar APENAS no admin — não expõe ao público.
     */
    function mp_tracking_ip_diagnostics()
    {
        $headers = mp_tracking_collect_raw_ip_headers();
        $effective = mp_tracking_client_ip();
        $remote = $headers['REMOTE_ADDR'];

        $suspicious = false;
        $reasons = array();

        if ($remote !== '' && mp_tracking_ip_is_private($remote)) {
            $suspicious = true;
            $reasons[] = 'REMOTE_ADDR é privado/loopback (' . $remote . ').';
        }
        if ($headers['HTTP_CF_CONNECTING_IP'] !== '' && $headers['HTTP_CF_CONNECTING_IP'] !== $remote) {
            $suspicious = true;
            $reasons[] = 'CF-Connecting-IP difere de REMOTE_ADDR.';
        }
        if ($headers['HTTP_X_FORWARDED_FOR'] !== '') {
            $reasons[] = 'X-Forwarded-For presente.';
            // só conta como suspicious se for diferente de REMOTE_ADDR
            $first = trim((string)strtok($headers['HTTP_X_FORWARDED_FOR'], ','));
            if ($first !== '' && $first !== $remote) $suspicious = true;
        }
        if ($effective !== '' && $effective !== $remote) {
            // já assinalado acima por uma das razões; deixa explícito
            $suspicious = true;
        }

        return array(
            'effective'             => $effective,
            'effective_is_public'   => mp_tracking_ip_is_public($effective),
            'remote_addr'           => $remote,
            'cf_connecting_ip'      => $headers['HTTP_CF_CONNECTING_IP'],
            'x_real_ip'             => $headers['HTTP_X_REAL_IP'],
            'x_forwarded_for'       => $headers['HTTP_X_FORWARDED_FOR'],
            'client_ip'             => $headers['HTTP_CLIENT_IP'],
            'suspicious'            => $suspicious,
            'reasons'               => $reasons,
        );
    }

    /**
     * Mascara um IP para apresentação não-sensível (ex.: visitantes em
     * tempo real). IPv4 → "x.y.zz.xxx" (últimos dois octetos ocultos).
     * IPv6 → mantém só os primeiros 2 hextets. Inválido → "—".
     */
    function mp_tracking_mask_ip($ip)
    {
        $ip = (string)$ip;
        if ($ip === '' || !filter_var($ip, FILTER_VALIDATE_IP)) return '—';
        if (strpos($ip, ':') !== false) {
            $parts = explode(':', $ip);
            $head = array_slice($parts, 0, 2);
            return implode(':', $head) . ':xxxx:xxxx';
        }
        $parts = explode('.', $ip);
        if (count($parts) === 4) {
            return $parts[0] . '.' . $parts[1] . '.xxx.xxx';
        }
        return '—';
    }

    /**
     * Log privado de eventos descartados por ignore list / rate limit /
     * outro motivo. Não falha o endpoint chamador; absorve qualquer erro.
     * Não guarda dados pessoais.
     */
    function mp_tracking_log_skipped_event(array $info)
    {
        try {
            $dir = mp_db_private_dir();
            if ($dir === null) return false;
            $path = $dir . '/order-funnel-skipped-events.jsonl';

            $line = array(
                'timestamp_iso'  => isset($info['timestamp_iso']) ? (string)$info['timestamp_iso'] : mp_db_now(),
                'effective_ip'   => isset($info['effective_ip']) ? (string)$info['effective_ip'] : '',
                'skip_reason'    => isset($info['skip_reason']) ? (string)$info['skip_reason'] : '',
                'event_name'     => isset($info['event_name']) ? substr((string)$info['event_name'], 0, 60) : '',
                'product_slug'   => isset($info['product_slug']) ? substr((string)$info['product_slug'], 0, 60) : '',
                'session_id'     => isset($info['session_id']) ? substr((string)$info['session_id'], 0, 64) : '',
                'user_agent'     => isset($info['user_agent']) ? substr((string)$info['user_agent'], 0, 240) : '',
            );
            $encoded = json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false) return false;
            $ok = @file_put_contents($path, $encoded . "\n", FILE_APPEND | LOCK_EX);
            @chmod($path, 0600);
            return $ok !== false;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_tracking_log_skipped_event falhou: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Converte um timestamp ISO 8601 (UTC) numa string em português
     * relativa/intuitiva. Usa timezone Europe/Lisbon para representação
     * absoluta. Não levanta excepções.
     *
     * Exemplos: "Agora", "há 30 s", "há 4 min", "Hoje às 15:42",
     *           "Ontem às 21:10", "12/05 às 09:30".
     */
    function mp_tracking_humanize_iso($iso, $nowTs = null)
    {
        $iso = (string)$iso;
        if ($iso === '') return '—';
        $ts = strtotime($iso);
        if ($ts === false) return '—';
        if ($nowTs === null) $nowTs = time();
        $delta = $nowTs - $ts;
        if ($delta < 0) $delta = 0;

        if ($delta < 10)   return 'Agora';
        if ($delta < 60)   return 'há ' . $delta . ' s';
        if ($delta < 3600) return 'há ' . (int)floor($delta / 60) . ' min';

        $tz = null;
        try { $tz = new DateTimeZone('Europe/Lisbon'); }
        catch (Exception $e) { $tz = null; }
        $local = new DateTime('@' . $ts);
        $today = new DateTime('@' . $nowTs);
        if ($tz) { $local->setTimezone($tz); $today->setTimezone($tz); }

        $localDay = $local->format('Y-m-d');
        $todayDay = $today->format('Y-m-d');
        $yesterday = clone $today;
        $yesterday->modify('-1 day');
        $yesterdayDay = $yesterday->format('Y-m-d');

        if ($localDay === $todayDay) return 'Hoje às ' . $local->format('H:i');
        if ($localDay === $yesterdayDay) return 'Ontem às ' . $local->format('H:i');
        return $local->format('d/m') . ' às ' . $local->format('H:i');
    }

    /**
     * Formata uma duração em segundos como "2 min", "14 min" ou
     * "1 h 05 min". Útil para resumir tempo de sessão no dashboard.
     */
    function mp_tracking_humanize_duration($seconds)
    {
        $seconds = (int)round((float)$seconds);
        if ($seconds < 60) return $seconds . ' s';
        if ($seconds < 3600) return (int)floor($seconds / 60) . ' min';
        $h = (int)floor($seconds / 3600);
        $m = (int)floor(($seconds % 3600) / 60);
        return $h . ' h ' . str_pad((string)$m, 2, '0', STR_PAD_LEFT) . ' min';
    }
}
