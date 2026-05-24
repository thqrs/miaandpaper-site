<?php
/**
 * lib/db.php — SQLITE_INFRA_V1
 *
 * Camada de acesso única à base SQLite privada do site Mia & Paper.
 * - Ficheiro: miaandpaper.sqlite no armazenamento privado resolvido por
 *   lib/private-paths.php
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

require_once __DIR__ . '/private-paths.php';

if (!defined('MIAANDPAPER_DB_LOADED')) {
    define('MIAANDPAPER_DB_LOADED', true);

    /**
     * Caminho absoluto para a pasta privada, resolvido de forma central.
     */
    function mp_db_private_dir()
    {
        return mp_private_dir();
    }

    function mp_db_path()
    {
        return mp_private_path('miaandpaper.sqlite');
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
                customer_nif TEXT,
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
            '2026-05-24_add_orders_customer_nif' => "ALTER TABLE orders ADD COLUMN customer_nif TEXT",
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
            // FUNNEL_SELECTION_SNAPSHOT_V1 — Phase 4
            // Coluna dedicada para snapshots de selecção do produto. Mantemos
            // event_json para a flexibilidade existente; selection_json é
            // semanticamente separada (escolhas de design/pack/laminação) e
            // mais fácil de inspeccionar no admin.
            '2026-05-16_add_funnel_selection_json' => "ALTER TABLE funnel_events ADD COLUMN selection_json TEXT",
            '2026-05-16_add_funnel_archive_selection_json' => "ALTER TABLE funnel_events_archive ADD COLUMN selection_json TEXT",
            // ORIGINAL_ATTRIBUTION_V1 — Phase 3
            // Cache simples (string) das origens originais para queries rápidas
            // de "Origem dos visitantes" sem desserializar event_json em cada
            // linha. Continuamos a guardar tudo em event_json também.
            '2026-05-16_add_funnel_first_referrer' => "ALTER TABLE funnel_events ADD COLUMN first_referrer TEXT",
            '2026-05-16_add_funnel_utm_source' => "ALTER TABLE funnel_events ADD COLUMN utm_source TEXT",
            // IP_LOOKUP_CACHE_V1 — Phase 2
            // Cache de enriquecimento de IP (GeoIP + RDAP). NUNCA preenchida
            // pelo endpoint público; apenas pelo dashboard admin a pedido.
            '2026-05-16_init_ip_lookup_cache' => "CREATE TABLE IF NOT EXISTS ip_lookup_cache (
                ip TEXT PRIMARY KEY,
                country_code TEXT,
                country_name TEXT,
                region TEXT,
                city TEXT,
                latitude REAL,
                longitude REAL,
                isp TEXT,
                org TEXT,
                asn TEXT,
                network_name TEXT,
                rdap_url TEXT,
                abuse_email TEXT,
                reverse_dns TEXT,
                is_hosting_guess INTEGER,
                source TEXT,
                raw_json TEXT,
                last_checked_at TEXT,
                lookup_error TEXT
            )",
            '2026-05-16_idx_ip_lookup_country' => "CREATE INDEX IF NOT EXISTS idx_ip_lookup_country
                ON ip_lookup_cache (country_code)",
        );

        $check = $pdo->prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
        $insert = $pdo->prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");

        foreach ($migrations as $id => $sql) {
            $check->execute(array($id));
            if ($check->fetch()) {
                continue;
            }
            try {
                $pdo->exec($sql);
            } catch (Exception $e) {
                // ALTER TABLE ADD COLUMN throws "duplicate column name" if the
                // column already exists but the migration row was lost
                // (manual edit, partial restore). Treat as already applied so
                // the rest of the migration loop continues and the id is
                // recorded — prevents repeating the failure on every request.
                if (stripos($e->getMessage(), 'duplicate column name') === false) {
                    throw $e;
                }
            }
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
            'customer_name', 'customer_contact', 'customer_nif', 'contact_email', 'contact_phone',
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
            // FUNNEL_SELECTION_SNAPSHOT_V1 + ORIGINAL_ATTRIBUTION_V1
            'selection_json', 'first_referrer', 'utm_source',
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
            $path = mp_private_path('order-funnel-skipped-events.jsonl');
            if ($path === null) return false;

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

    // ----- LIVE_VISITOR_LABEL_V1 (Phase 1) -----
    //
    // Etiqueta curta e estável por IP, evitando termos pessoais. Determinística:
    // o mesmo IP gera sempre a mesma etiqueta sem precisar de guardar nada.
    function mp_visitor_label_for_ip($ip)
    {
        $ip = (string)$ip;
        if ($ip === '') return 'Anónimo';
        $hash = substr(md5($ip), 0, 6);
        $letters = strtoupper(substr($hash, 0, 1));
        $digits  = substr($hash, 1, 2);
        // ex: A26, B14, F92
        return $letters . $digits;
    }

    /**
     * Decodifica JSON com defensiva: nunca lança. Devolve array em caso de
     * sucesso, valor por defeito ou array vazio caso contrário.
     */
    function mp_safe_json_decode($raw, $defaultValue = null)
    {
        if (!is_string($raw) || $raw === '') {
            return $defaultValue === null ? array() : $defaultValue;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return $defaultValue === null ? array() : $defaultValue;
        }
        return $decoded;
    }

    // ----- ORIGINAL_ATTRIBUTION_V1 (Phase 3) -----
    //
    // Classifica a origem da visita. Prioridade: UTM > first_referrer >
    // referrer actual > unknown/direct. Devolve categoria curta e fonte raw.
    function mp_attribution_classify($extra)
    {
        $utm = isset($extra['utm_source']) ? strtolower((string)$extra['utm_source']) : '';
        $firstRef = isset($extra['first_referrer']) ? (string)$extra['first_referrer'] : '';
        $curRef   = isset($extra['referrer']) ? (string)$extra['referrer'] : '';
        $fbclid   = !empty($extra['fbclid']);
        $gclid    = !empty($extra['gclid']);
        $raw      = '';
        $category = 'Desconhecido';

        if ($utm !== '') {
            $raw = $utm;
            $category = mp_attribution_category_from_token($utm);
        } elseif ($fbclid) {
            $raw = 'fbclid'; $category = 'Facebook';
        } elseif ($gclid) {
            $raw = 'gclid'; $category = 'Google';
        } elseif ($firstRef !== '') {
            $raw = $firstRef;
            $category = mp_attribution_category_from_url($firstRef);
        } elseif ($curRef !== '') {
            $raw = $curRef;
            $category = mp_attribution_category_from_url($curRef);
        } else {
            $category = 'Directo';
        }
        return array('category' => $category, 'raw' => $raw);
    }

    function mp_attribution_category_from_token($token)
    {
        $token = strtolower((string)$token);
        if ($token === '') return 'Desconhecido';
        if (strpos($token, 'instagram') !== false || $token === 'ig') return 'Instagram';
        if (strpos($token, 'facebook') !== false || $token === 'fb' || strpos($token, 'meta') !== false) return 'Facebook';
        if (strpos($token, 'whatsapp') !== false || strpos($token, 'wapp') !== false || $token === 'wa') return 'WhatsApp';
        if (strpos($token, 'google') !== false || $token === 'gads' || $token === 'g') return 'Google';
        if (strpos($token, 'tiktok') !== false) return 'TikTok';
        if (strpos($token, 'youtube') !== false) return 'YouTube';
        if (strpos($token, 'email') !== false || strpos($token, 'newsletter') !== false) return 'Email';
        return ucfirst($token);
    }

    function mp_attribution_category_from_url($url)
    {
        $url = strtolower((string)$url);
        if ($url === '') return 'Directo';
        // Internal traffic — referrer aponta para o próprio site.
        if (strpos($url, 'miaandpaper.com') !== false || strpos($url, 'localhost') !== false || strpos($url, '127.0.0.1') !== false) {
            return 'Navegação interna';
        }
        if (strpos($url, 'instagram') !== false || strpos($url, '/l.instagram.com') !== false) return 'Instagram';
        if (strpos($url, 'facebook') !== false || strpos($url, 'fb.com') !== false || strpos($url, '/l.facebook.com') !== false || strpos($url, 'm.facebook') !== false) return 'Facebook';
        if (strpos($url, 'whatsapp') !== false || strpos($url, 'wa.me') !== false || strpos($url, 'api.whatsapp') !== false) return 'WhatsApp';
        if (strpos($url, 'google.') !== false) return 'Google';
        if (strpos($url, 'tiktok') !== false) return 'TikTok';
        if (strpos($url, 'youtube') !== false || strpos($url, 'youtu.be') !== false) return 'YouTube';
        if (strpos($url, 'bing.com') !== false) return 'Bing';
        if (strpos($url, 'duckduckgo') !== false) return 'DuckDuckGo';
        if (strpos($url, 'mail.') !== false || strpos($url, 'gmail') !== false || strpos($url, 'outlook') !== false) return 'Email';
        return 'Outro';
    }

    // ----- IP_LOOKUP_CACHE_V1 (Phase 2) -----
    //
    // Funções para enriquecimento de IPs (GeoIP + RDAP). NUNCA chamadas a
    // partir de track-order-event.php nem no carregamento de páginas públicas.
    // Apenas executadas dentro de admin-funnel.php a pedido do admin.

    function mp_ip_lookup_get($ip)
    {
        $ip = (string)$ip;
        if ($ip === '') return null;
        try {
            $pdo = mp_db();
            $stmt = $pdo->prepare('SELECT * FROM ip_lookup_cache WHERE ip = ? LIMIT 1');
            $stmt->execute(array($ip));
            $row = $stmt->fetch();
            return $row ?: null;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_ip_lookup_get falhou: ' . $e->getMessage());
            return null;
        }
    }

    function mp_ip_lookup_get_many(array $ips)
    {
        if (empty($ips)) return array();
        $ips = array_values(array_filter(array_map('mp_db_normalize_ip', $ips), 'strlen'));
        if (empty($ips)) return array();
        try {
            $pdo = mp_db();
            $placeholders = implode(',', array_fill(0, count($ips), '?'));
            $stmt = $pdo->prepare('SELECT * FROM ip_lookup_cache WHERE ip IN (' . $placeholders . ')');
            $stmt->execute($ips);
            $out = array();
            foreach ($stmt->fetchAll() as $row) {
                $out[$row['ip']] = $row;
            }
            return $out;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_ip_lookup_get_many falhou: ' . $e->getMessage());
            return array();
        }
    }

    function mp_ip_lookup_save($ip, array $data)
    {
        $ip = mp_db_normalize_ip($ip);
        if ($ip === '') return false;
        try {
            $pdo = mp_db();
            $cols = array(
                'ip', 'country_code', 'country_name', 'region', 'city',
                'latitude', 'longitude', 'isp', 'org', 'asn', 'network_name',
                'rdap_url', 'abuse_email', 'reverse_dns', 'is_hosting_guess',
                'source', 'raw_json', 'last_checked_at', 'lookup_error',
            );
            $values = array();
            foreach ($cols as $c) {
                if ($c === 'ip') { $values[] = $ip; continue; }
                if ($c === 'last_checked_at') { $values[] = isset($data[$c]) ? $data[$c] : mp_db_now(); continue; }
                $values[] = isset($data[$c]) ? $data[$c] : null;
            }
            $placeholders = implode(',', array_fill(0, count($cols), '?'));
            $sql = 'INSERT OR REPLACE INTO ip_lookup_cache (' . implode(',', $cols) . ') VALUES (' . $placeholders . ')';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
            return true;
        } catch (Exception $e) {
            @error_log('[miaandpaper] mp_ip_lookup_save falhou: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Chamada HTTP simples via cURL (ou fallback file_get_contents).
     * Devolve o body ou null. Timeouts curtos: nunca podemos bloquear o
     * dashboard. Sempre HTTPS.
     */
    function mp_ip_lookup_http_get($url, $headers = array(), $timeoutSeconds = 4)
    {
        $url = (string)$url;
        if (strpos($url, 'https://') !== 0) return null;

        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $timeoutSeconds);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, max(2, (int)floor($timeoutSeconds / 2)));
            curl_setopt($ch, CURLOPT_USERAGENT, 'MiaAndPaper-Admin/1.0 (+https://miaandpaper.com)');
            if (!empty($headers)) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            }
            $body = curl_exec($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($body === false || $status < 200 || $status >= 300) return null;
            return $body;
        }

        $ctx = stream_context_create(array(
            'http' => array(
                'method' => 'GET',
                'header' => implode("\r\n", array_merge(array('User-Agent: MiaAndPaper-Admin/1.0'), $headers)),
                'timeout' => $timeoutSeconds,
                'ignore_errors' => true,
            ),
            'ssl' => array(
                'verify_peer' => true,
                'verify_peer_name' => true,
            ),
        ));
        $body = @file_get_contents($url, false, $ctx);
        return $body === false ? null : $body;
    }

    /**
     * Faz o lookup de um IP usando ip-api.com (HTTPS) e RDAP da ARIN.
     * Devolve um array com os campos preenchidos (mesma forma da tabela
     * ip_lookup_cache). Em caso de erro devolve um array com lookup_error
     * preenchido — gravamos na mesma para evitar repetições.
     */
    function mp_ip_lookup_fetch($ip)
    {
        $ip = mp_db_normalize_ip($ip);
        if ($ip === '') {
            return array('lookup_error' => 'IP inválido', 'source' => 'invalid', 'last_checked_at' => mp_db_now());
        }
        // IPs privados/reservados não fazem geolocalização — assinala e cacheia.
        if (!mp_tracking_ip_is_public($ip)) {
            return array(
                'country_code' => '',
                'country_name' => 'Rede privada/local',
                'is_hosting_guess' => 0,
                'source' => 'private',
                'lookup_error' => '',
                'last_checked_at' => mp_db_now(),
            );
        }

        $out = array(
            'country_code' => null, 'country_name' => null, 'region' => null, 'city' => null,
            'latitude' => null, 'longitude' => null, 'isp' => null, 'org' => null, 'asn' => null,
            'network_name' => null, 'rdap_url' => null, 'abuse_email' => null, 'reverse_dns' => null,
            'is_hosting_guess' => null, 'source' => null, 'raw_json' => null,
            'last_checked_at' => mp_db_now(), 'lookup_error' => null,
        );

        // Geo + ISP via ip-api.com (HTTPS, gratuito, sem chave para pequenos volumes).
        $body = mp_ip_lookup_http_get('https://ipwho.is/' . rawurlencode($ip), array('Accept: application/json'));
        $usedSource = 'ipwho.is';
        $json = is_string($body) ? json_decode($body, true) : null;
        if (is_array($json) && !empty($json['success'])) {
            $out['country_code'] = isset($json['country_code']) ? (string)$json['country_code'] : null;
            $out['country_name'] = isset($json['country']) ? (string)$json['country'] : null;
            $out['region']       = isset($json['region']) ? (string)$json['region'] : null;
            $out['city']         = isset($json['city']) ? (string)$json['city'] : null;
            $out['latitude']     = isset($json['latitude']) ? (float)$json['latitude'] : null;
            $out['longitude']    = isset($json['longitude']) ? (float)$json['longitude'] : null;
            $out['isp']          = isset($json['connection']['isp']) ? (string)$json['connection']['isp'] : null;
            $out['org']          = isset($json['connection']['org']) ? (string)$json['connection']['org'] : null;
            $asn = isset($json['connection']['asn']) ? (string)$json['connection']['asn'] : '';
            $out['asn']          = $asn !== '' ? ('AS' . ltrim($asn, 'AS')) : null;
            $out['raw_json']     = json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $out['source']       = $usedSource;
            // Heurística de hosting: se ISP/org parece datacenter/cloud
            $orgIspLower = strtolower(((string)$out['isp']) . ' ' . ((string)$out['org']));
            $hostingTokens = array('cloud', 'host', 'amazon', 'aws', 'azure', 'microsoft', 'google llc', 'digitalocean', 'ovh', 'hetzner', 'linode', 'akamai', 'cloudflare', 'datacenter', 'data center', 'colocation', 'leaseweb', 'oracle', 'vps');
            $isHosting = 0;
            foreach ($hostingTokens as $t) {
                if (strpos($orgIspLower, $t) !== false) { $isHosting = 1; break; }
            }
            $out['is_hosting_guess'] = $isHosting;
        } else {
            $out['source'] = $usedSource;
            $out['lookup_error'] = 'geo_unavailable';
        }

        // RDAP via rdap.arin.net (HTTPS). ARIN faz proxy para outros RIRs.
        // Não usamos WHOIS bruto na porta 43 (per request).
        $rdap = mp_ip_lookup_http_get('https://rdap.arin.net/registry/ip/' . rawurlencode($ip), array('Accept: application/rdap+json'), 4);
        if (is_string($rdap)) {
            $rj = json_decode($rdap, true);
            if (is_array($rj)) {
                if (!empty($rj['name'])) $out['network_name'] = (string)$rj['name'];
                if (!empty($rj['handle'])) $out['rdap_url'] = 'https://rdap.arin.net/registry/ip/' . rawurlencode($ip);
                // Procura email de abuso nos entities.
                $abuseEmail = mp_rdap_extract_abuse_email($rj);
                if ($abuseEmail !== '') $out['abuse_email'] = $abuseEmail;
                if ($out['raw_json']) {
                    // Anexa raw RDAP truncado para histórico.
                    $existing = json_decode($out['raw_json'], true);
                    if (is_array($existing)) {
                        $existing['_rdap'] = $rj;
                        $enc = json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                        if ($enc !== false && strlen($enc) <= 32000) $out['raw_json'] = $enc;
                    }
                } else {
                    $enc = json_encode(array('_rdap' => $rj), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    if ($enc !== false && strlen($enc) <= 32000) $out['raw_json'] = $enc;
                }
            }
        }

        // Reverse DNS é local e barato — não exige HTTPS.
        $rev = @gethostbyaddr($ip);
        if (is_string($rev) && $rev !== '' && $rev !== $ip) {
            $out['reverse_dns'] = substr($rev, 0, 240);
            // Reforça hosting guess se o reverse contém tokens típicos.
            $revLower = strtolower($rev);
            $hostingHints = array('.amazonaws.', '.googleusercontent', '.azure.', '.cloud.', 'dedicated.', 'vps.', '.linode.', '.ovh.', '.hetzner.', '.digitalocean.');
            foreach ($hostingHints as $h) {
                if (strpos($revLower, $h) !== false) {
                    $out['is_hosting_guess'] = 1;
                    break;
                }
            }
        }

        return $out;
    }

    function mp_rdap_extract_abuse_email($rdap)
    {
        if (!is_array($rdap)) return '';
        $entities = isset($rdap['entities']) ? $rdap['entities'] : array();
        foreach ($entities as $entity) {
            $roles = isset($entity['roles']) ? $entity['roles'] : array();
            if (!is_array($roles) || !in_array('abuse', $roles, true)) continue;
            $vcard = isset($entity['vcardArray']) ? $entity['vcardArray'] : null;
            if (is_array($vcard) && isset($vcard[1]) && is_array($vcard[1])) {
                foreach ($vcard[1] as $entry) {
                    if (is_array($entry) && isset($entry[0]) && $entry[0] === 'email' && isset($entry[3])) {
                        return (string)$entry[3];
                    }
                }
            }
        }
        return '';
    }

    // ----- FUNNEL_DAILY_JSONL_V1 (Phase G) -----
    //
    // JSONL fallback agora separado por dia em
    //   private/funnel-jsonl/YYYY-MM-DD.jsonl
    //
    // Mantemos o ficheiro único antigo (private/order-funnel-events.jsonl) à parte;
    // não o tocamos. Os dois podem coexistir. Helpers expostos para o admin
    // poder listar dias disponíveis e carregar só o intervalo pedido.

    function mp_funnel_jsonl_dir()
    {
        $dir = mp_private_path('funnel-jsonl');
        if ($dir === null) return null;
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        return is_dir($dir) ? $dir : null;
    }

    function mp_funnel_jsonl_path_for_date($date)
    {
        $dir = mp_funnel_jsonl_dir();
        if ($dir === null) return null;
        // Aceita 'YYYY-MM-DD' ou um timestamp ISO. Sempre UTC.
        $date = (string)$date;
        if ($date === '') $date = gmdate('Y-m-d');
        elseif (strlen($date) > 10) $date = substr($date, 0, 10);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = gmdate('Y-m-d');
        }
        return rtrim($dir, "\\/") . DIRECTORY_SEPARATOR . $date . '.jsonl';
    }

    function mp_funnel_append_jsonl_event(array $line)
    {
        // Escolhe o dia a partir do timestamp do evento; senão hoje (UTC).
        $iso = isset($line['timestamp_iso']) ? (string)$line['timestamp_iso'] : '';
        $date = '';
        if ($iso !== '' && strlen($iso) >= 10) $date = substr($iso, 0, 10);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = gmdate('Y-m-d');

        $path = mp_funnel_jsonl_path_for_date($date);
        if ($path === null) return false;

        $encoded = json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) return false;
        // Append atómico, mantém permissões restritas. Erros silenciosos.
        $ok = @file_put_contents($path, $encoded . "\n", FILE_APPEND | LOCK_EX);
        @chmod($path, 0600);
        if ($ok === false) {
            @error_log('[miaandpaper] funnel daily JSONL write falhou: ' . $path);
            return false;
        }
        return true;
    }

    function mp_funnel_jsonl_list_files()
    {
        $dir = mp_funnel_jsonl_dir();
        if ($dir === null) return array();
        $out = array();
        $entries = @scandir($dir);
        if (!is_array($entries)) return array();
        foreach ($entries as $name) {
            if (!preg_match('/^(\d{4}-\d{2}-\d{2})\.jsonl$/', $name, $m)) continue;
            $full = rtrim($dir, "\\/") . DIRECTORY_SEPARATOR . $name;
            $size = @filesize($full);
            $out[] = array(
                'date' => $m[1],
                'path' => $full,
                'size' => $size === false ? 0 : (int)$size,
                'mtime' => @filemtime($full) ?: 0,
            );
        }
        usort($out, function ($a, $b) { return strcmp($b['date'], $a['date']); });
        return $out;
    }

    function mp_funnel_jsonl_files_for_range($startDate, $endDate)
    {
        $startDate = substr((string)$startDate, 0, 10);
        $endDate = substr((string)$endDate, 0, 10);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            return array();
        }
        if ($startDate > $endDate) { $tmp = $startDate; $startDate = $endDate; $endDate = $tmp; }
        $dir = mp_funnel_jsonl_dir();
        if ($dir === null) return array();
        $out = array();
        $cur = $startDate;
        $safety = 0;
        while ($cur <= $endDate && $safety++ < 400) { // máx ~400 dias
            $path = rtrim($dir, "\\/") . DIRECTORY_SEPARATOR . $cur . '.jsonl';
            if (is_file($path)) {
                $out[] = array('date' => $cur, 'path' => $path);
            }
            $ts = strtotime($cur . 'T00:00:00Z');
            $cur = gmdate('Y-m-d', $ts + 86400);
        }
        return $out;
    }

    /**
     * Conta linhas (eventos) de um ficheiro JSONL. Operação barata via fgets.
     * Devolve int ou -1 se erro.
     */
    function mp_funnel_jsonl_count_lines($path)
    {
        if (!is_file($path)) return 0;
        $fp = @fopen($path, 'r');
        if (!$fp) return -1;
        $count = 0;
        while (!feof($fp)) {
            if (fgets($fp) !== false) $count++;
        }
        fclose($fp);
        return $count;
    }

    /**
     * Lê eventos de um array de paths JSONL. Aplica filtros opcionais e limites
     * de memória. Devolve array de eventos decodificados.
     */
    function mp_funnel_jsonl_load_events(array $files, $maxEvents = 5000)
    {
        $events = array();
        $count = 0;
        foreach ($files as $f) {
            $path = is_array($f) ? ($f['path'] ?? '') : (string)$f;
            if (!is_file($path)) continue;
            $fp = @fopen($path, 'r');
            if (!$fp) continue;
            while (!feof($fp)) {
                $line = fgets($fp);
                if ($line === false) break;
                $line = trim($line);
                if ($line === '') continue;
                $obj = json_decode($line, true);
                if (!is_array($obj)) continue;
                $events[] = $obj;
                if (++$count >= $maxEvents) break 2;
            }
            fclose($fp);
        }
        return $events;
    }

    // ----- PII_FILTER_BANNED_V2 (Phase M) -----
    // Lista canónica de chaves a remover de selection_json/event_metadata
    // antes de gravar. Defesa em profundidade; o cliente nunca devia enviar
    // isto, mas se enviar (bug ou abuso), filtramos.
    function mp_funnel_pii_banned_keys()
    {
        return array(
            // Identidade
            'name', 'customer_name', 'customer_nif', 'nif', 'card_name',
            // Contacto
            'email', 'customer_email', 'contact_email', 'copy_email',
            'phone', 'customer_phone', 'contact_phone',
            'customer_contact', 'card_contact',
            // Morada / institucional
            'address', 'shipping_address', 'billing_address',
            'congregation', 'church',
            // Texto livre
            'message', 'note', 'notes', 'comment', 'comments',
            'personalization', 'personalization_text', 'personalisation', 'personalisation_text',
            'cover_personalization_text', 'personalization_phrase',
            'custom_text', 'typed_text', 'free_text',
        );
    }

    function mp_funnel_strip_pii(array $obj)
    {
        $banned = mp_funnel_pii_banned_keys();
        // case-insensitive comparison
        $bannedLc = array_map('strtolower', $banned);
        $out = array();
        foreach ($obj as $k => $v) {
            if (in_array(strtolower((string)$k), $bannedLc, true)) continue;
            // Recurse into arrays
            if (is_array($v)) {
                $v = mp_funnel_strip_pii($v);
            }
            $out[$k] = $v;
        }
        return $out;
    }

    // ----- REFERRER_CLASSIFY_V1 (Phase B) -----
    // Versão servidor — utilizada como fallback para classificar quando o
    // cliente não enviou referrer_type explícito.
    function mp_funnel_classify_referrer($referrer, $firstReferrer = '', $utmSource = '')
    {
        $utmSource = strtolower(trim((string)$utmSource));
        if ($utmSource !== '') {
            return mp_attribution_category_from_token($utmSource);
        }
        $candidate = trim((string)$firstReferrer);
        if ($candidate === '') $candidate = trim((string)$referrer);
        if ($candidate === '') return 'direct';
        $cat = mp_attribution_category_from_url($candidate);
        // Mapeia para o vocabulário pedido (lower-case).
        $map = array(
            'Instagram' => 'instagram',
            'Facebook'  => 'facebook',
            'WhatsApp'  => 'whatsapp',
            'Google'    => 'google',
            'TikTok'    => 'tiktok',
            'YouTube'   => 'youtube',
            'Bing'      => 'bing',
            'DuckDuckGo'=> 'duckduckgo',
            'Email'     => 'email',
            'Directo'   => 'direct',
            'Navegação interna' => 'internal',
            'Outro'     => 'unknown',
        );
        return isset($map[$cat]) ? $map[$cat] : strtolower($cat);
    }

    /**
     * Faz lookup de até $maxNew IPs novos a partir da lista fornecida.
     * Cacheia tudo (incluindo erros). Devolve o número de novos lookups
     * efectivamente realizados. NUNCA chamado fora do admin.
     */
    function mp_ip_lookup_enrich_batch(array $ips, $maxNew = 12)
    {
        $ips = array_values(array_unique(array_filter(array_map('mp_db_normalize_ip', $ips), 'strlen')));
        if (empty($ips)) return 0;
        $existing = mp_ip_lookup_get_many($ips);
        $todo = array();
        foreach ($ips as $ip) {
            if (!isset($existing[$ip])) $todo[] = $ip;
            if (count($todo) >= $maxNew) break;
        }
        $done = 0;
        foreach ($todo as $ip) {
            $data = mp_ip_lookup_fetch($ip);
            if (mp_ip_lookup_save($ip, $data)) $done++;
        }
        return $done;
    }
}
