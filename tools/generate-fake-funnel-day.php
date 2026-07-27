<?php
/**
 * tools/generate-fake-funnel-day.php
 *
 * Standalone local fixture generator: produces fake but realistic-looking
 * funnel events for ONE day, matching the field shapes used by the live
 * implementation (track-order-event.php / app.js / admin-live-dashboard.php).
 *
 * SAFETY:
 *  - Reads ONLY: site/content/products/*.json (to use real design IDs / image paths)
 *  - Writes ONLY: local-test-data/funnel-fixtures/  (and local-test-data/fake-private/ with --sqlite)
 *  - Never touches the real private/ folder, real SQLite, or real JSONL files.
 *  - Never modifies site/ source files.
 *
 * USAGE:
 *   php tools/generate-fake-funnel-day.php
 *   php tools/generate-fake-funnel-day.php --date=2026-05-16 --sessions=40 --seed=123
 *   php tools/generate-fake-funnel-day.php --config=tools/funnel-fixture-config.example.json
 *   php tools/generate-fake-funnel-day.php --preset=busy-day --sqlite --overwrite
 *
 * Run `php tools/generate-fake-funnel-day.php --help` for the full list.
 *
 * PII safety:
 *   The generator never emits names, emails, phones, addresses, congregations,
 *   or typed personalization text. Only static product values, IDs, image paths,
 *   referrer types and device/viewport/timing/IP fields appear.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "This tool is CLI-only.\n";
    exit(1);
}

// ----------------------------------------------------------------------
// argv parsing
// ----------------------------------------------------------------------
function fx_parse_args(array $argv) {
    $out = array('flags' => array(), 'opts' => array());
    foreach (array_slice($argv, 1) as $arg) {
        if (strpos($arg, '--') !== 0) continue;
        $eq = strpos($arg, '=');
        if ($eq === false) {
            $out['flags'][substr($arg, 2)] = true;
        } else {
            $out['opts'][substr($arg, 2, $eq - 2)] = substr($arg, $eq + 1);
        }
    }
    return $out;
}

function fx_print_help() {
    $help = <<<HELP

generate-fake-funnel-day.php — local fixture generator for the Live Dashboard.

USAGE
  php tools/generate-fake-funnel-day.php [options]

OPTIONS (CLI)
  --date=YYYY-MM-DD       Fictitious day (default: today, UTC)
  --sessions=N            Number of fake sessions (default: 35)
  --seed=N                Deterministic random seed (default: derived from date)
  --out=PATH              Output folder (default: local-test-data/funnel-fixtures)
  --sqlite                Also generate a drop-in fake-private/ folder
                          (with miaandpaper.sqlite + funnel-jsonl/ + admin.php)
                          so the live dashboard can be tested visually.
  --overwrite             Overwrite existing files. Default is to refuse.
  --config=PATH           Load JSON config (date/sessions/products/scripted_sessions/...)
  --preset=NAME           Apply a preset (busy-day, quiet-day, cadernos-launch,
                          instagram-campaign, map-test, replay-test).
  --strict                Stop on invalid scripted journey steps.
  --list-presets          Print available preset names and exit.
  --help                  Print this help.

PRIORITY ORDER
  CLI flags > config file > preset > built-in defaults

OUTPUT
  Always: {out}/YYYY-MM-DD.jsonl       (raw daily JSONL, easy to inspect)
  --sqlite extras:
    local-test-data/fake-private/miaandpaper.sqlite          (drop-in DB)
    local-test-data/fake-private/funnel-jsonl/YYYY-MM-DD.jsonl
    local-test-data/fake-private/order-funnel-events.jsonl
    local-test-data/fake-private/admin.php                   (password "fixture")

VISUAL DASHBOARD TEST (with --sqlite)
  Stop your normal local server, then:
    MIAANDPAPER_PRIVATE_DIR=local-test-data/fake-private php -S 127.0.0.1:8080 -t site
  Open http://127.0.0.1:8080/index.html and log in via the admin button
  with password: fixture
  Then open admin-funnel.php and admin-live-dashboard.php.

DELETE FAKE DATA
  rm -rf local-test-data/

HELP;
    echo $help;
}

// ----------------------------------------------------------------------
// Presets
// ----------------------------------------------------------------------
function fx_presets() {
    return array(
        'busy-day' => array(
            'sessions' => 80,
            'behaviours' => array('submitted_orders' => 8, 'abandoned_after_designs' => 14, 'abandoned_after_options' => 16, 'selected_and_bought' => 8, 'selected_but_not_bought' => 18, 'magnified_but_not_selected' => 10, 'backtracking_sessions' => 12, 'validation_error_sessions' => 8, 'heartbeat_heavy_sessions' => 6),
            'products' => array('cadernos' => 28, 'crachas' => 20, 'imanes' => 12, 'caderninhos' => 12, 'homepage_only' => 8),
            'traffic_sources' => array('instagram' => 28, 'facebook' => 10, 'whatsapp' => 12, 'google' => 10, 'direct' => 16, 'internal_admin' => 4),
            'devices' => array('mobile' => 64, 'desktop' => 16),
            'map_locations' => array('portugal_lisbon' => 22, 'portugal_porto' => 12, 'brazil' => 8, 'uk' => 6, 'angola' => 4, 'france' => 4, 'local_private' => 24),
        ),
        'quiet-day' => array(
            'sessions' => 8,
            'behaviours' => array('submitted_orders' => 1, 'abandoned_after_designs' => 3, 'abandoned_after_options' => 2, 'selected_and_bought' => 1, 'selected_but_not_bought' => 2, 'magnified_but_not_selected' => 1, 'backtracking_sessions' => 1, 'validation_error_sessions' => 0, 'heartbeat_heavy_sessions' => 1),
            'products' => array('cadernos' => 3, 'crachas' => 2, 'imanes' => 1, 'caderninhos' => 1, 'homepage_only' => 1),
            'traffic_sources' => array('direct' => 4, 'instagram' => 2, 'google' => 2),
            'devices' => array('mobile' => 6, 'desktop' => 2),
            'map_locations' => array('portugal_lisbon' => 3, 'portugal_porto' => 1, 'local_private' => 4),
        ),
        'cadernos-launch' => array(
            'sessions' => 50,
            'behaviours' => array('submitted_orders' => 6, 'abandoned_after_designs' => 6, 'abandoned_after_options' => 14, 'selected_and_bought' => 6, 'selected_but_not_bought' => 16, 'magnified_but_not_selected' => 8, 'backtracking_sessions' => 8, 'validation_error_sessions' => 4, 'heartbeat_heavy_sessions' => 4),
            'products' => array('cadernos' => 40, 'crachas' => 4, 'imanes' => 2, 'caderninhos' => 2, 'homepage_only' => 2),
            'traffic_sources' => array('instagram' => 25, 'whatsapp' => 10, 'facebook' => 5, 'direct' => 6, 'google' => 4),
            'devices' => array('mobile' => 44, 'desktop' => 6),
            'map_locations' => array('portugal_lisbon' => 18, 'portugal_porto' => 10, 'brazil' => 6, 'angola' => 4, 'uk' => 4, 'france' => 2, 'local_private' => 6),
        ),
        'instagram-campaign' => array(
            'sessions' => 50,
            'behaviours' => array('submitted_orders' => 5, 'abandoned_after_designs' => 10, 'abandoned_after_options' => 12, 'selected_and_bought' => 5, 'selected_but_not_bought' => 15, 'magnified_but_not_selected' => 8, 'backtracking_sessions' => 8, 'validation_error_sessions' => 4, 'heartbeat_heavy_sessions' => 4),
            'products' => array('cadernos' => 22, 'crachas' => 16, 'imanes' => 6, 'caderninhos' => 4, 'homepage_only' => 2),
            'traffic_sources' => array('instagram' => 35, 'facebook' => 6, 'whatsapp' => 4, 'direct' => 3, 'google' => 2),
            'devices' => array('mobile' => 46, 'desktop' => 4),
            'map_locations' => array('portugal_lisbon' => 20, 'portugal_porto' => 12, 'brazil' => 8, 'uk' => 4, 'angola' => 2, 'france' => 2, 'local_private' => 2),
        ),
        'map-test' => array(
            'sessions' => 30,
            'behaviours' => array('submitted_orders' => 2, 'abandoned_after_designs' => 8, 'abandoned_after_options' => 8, 'selected_and_bought' => 2, 'selected_but_not_bought' => 8, 'magnified_but_not_selected' => 4, 'backtracking_sessions' => 4, 'validation_error_sessions' => 2, 'heartbeat_heavy_sessions' => 2),
            'products' => array('cadernos' => 10, 'crachas' => 8, 'imanes' => 4, 'caderninhos' => 4, 'homepage_only' => 4),
            'traffic_sources' => array('instagram' => 10, 'facebook' => 4, 'whatsapp' => 6, 'google' => 4, 'direct' => 6),
            'devices' => array('mobile' => 24, 'desktop' => 6),
            'map_locations' => array('portugal_lisbon' => 8, 'portugal_porto' => 6, 'brazil' => 4, 'uk' => 3, 'angola' => 2, 'france' => 3, 'local_private' => 4),
        ),
        'replay-test' => array(
            'sessions' => 6,
            'behaviours' => array('submitted_orders' => 1, 'abandoned_after_designs' => 1, 'abandoned_after_options' => 1, 'selected_and_bought' => 1, 'selected_but_not_bought' => 2, 'magnified_but_not_selected' => 1, 'backtracking_sessions' => 4, 'validation_error_sessions' => 3, 'heartbeat_heavy_sessions' => 3),
            'products' => array('cadernos' => 3, 'crachas' => 2, 'imanes' => 1),
            'traffic_sources' => array('instagram' => 2, 'whatsapp' => 1, 'google' => 1, 'direct' => 2),
            'devices' => array('mobile' => 5, 'desktop' => 1),
            'map_locations' => array('portugal_lisbon' => 3, 'portugal_porto' => 2, 'local_private' => 1),
        ),
    );
}

// ----------------------------------------------------------------------
// Defaults
// ----------------------------------------------------------------------
function fx_defaults() {
    return array(
        'date' => gmdate('Y-m-d'),
        'seed' => null,                 // derived from date if null
        'sessions' => 35,
        'output_dir' => 'local-test-data/funnel-fixtures',
        'overwrite' => false,
        'sqlite' => false,
        'strict' => false,
        'mode' => 'mixed',
        'products' => array(
            'cadernos' => 12, 'crachas' => 10, 'imanes' => 6,
            'caderninhos' => 4, 'homepage_only' => 3,
        ),
        'traffic_sources' => array(
            'instagram' => 12, 'facebook' => 4, 'whatsapp' => 5,
            'google' => 4, 'direct' => 8, 'internal_admin' => 2,
        ),
        'devices' => array('mobile' => 28, 'desktop' => 7),
        'behaviours' => array(
            'submitted_orders' => 4,
            'abandoned_after_designs' => 6,
            'abandoned_after_options' => 8,
            'magnified_but_not_selected' => 5,
            'selected_but_not_bought' => 10,
            'selected_and_bought' => 4,
            'backtracking_sessions' => 6,
            'validation_error_sessions' => 4,
            'heartbeat_heavy_sessions' => 3,
        ),
        'map_locations' => array(
            'portugal_lisbon' => 10, 'portugal_porto' => 5,
            'brazil' => 3, 'uk' => 2, 'angola' => 2,
            'france' => 2, 'local_private' => 11,
        ),
        'scripted_sessions' => array(),
    );
}

// Deep merge (associative arrays overwrite; lists overwrite as a whole).
function fx_deep_merge($base, $override) {
    if (!is_array($override)) return $override;
    if (!is_array($base)) return $override;
    // detect list (numeric keys) — overwrite as a whole
    if (array_keys($base) === range(0, count($base) - 1) || array_keys($override) === range(0, count($override) - 1)) {
        return $override;
    }
    $out = $base;
    foreach ($override as $k => $v) {
        $out[$k] = isset($base[$k]) ? fx_deep_merge($base[$k], $v) : $v;
    }
    return $out;
}

// ----------------------------------------------------------------------
// Product catalog (real product JSON files)
// ----------------------------------------------------------------------
function fx_load_catalog($projectRoot) {
    $catalog = array();
    $productDir = $projectRoot . '/site/content/products';
    if (!is_dir($productDir)) {
        fwrite(STDERR, "WARNING: $productDir not found. Designs will use generic IDs.\n");
        return $catalog;
    }
    foreach (glob($productDir . '/*.json') as $jsonPath) {
        $slug = basename($jsonPath, '.json');
        $raw = @file_get_contents($jsonPath);
        if ($raw === false) continue;
        $cfg = json_decode($raw, true);
        if (!is_array($cfg)) continue;
        $entry = array('name' => $cfg['name'] ?? $slug, 'steps' => array());
        foreach (($cfg['steps'] ?? array()) as $step) {
            $stepId = $step['id'] ?? '';
            if (!$stepId) continue;
            $items = array();
            foreach (($step['items'] ?? array()) as $it) {
                if (!is_array($it)) continue;
                $value = isset($it['value']) ? (string)$it['value'] : (string)($it['id'] ?? '');
                $id    = isset($it['id']) ? (string)$it['id'] : $value;
                $title = isset($it['title']) ? (string)$it['title'] : $value;
                $image = isset($it['image']) ? (string)$it['image'] : '';
                if ($value === '' && $id === '') continue;
                $items[] = array('value' => $value, 'id' => $id, 'title' => $title, 'image' => $image);
            }
            $entry['steps'][$stepId] = $items;
        }
        $catalog[$slug] = $entry;
    }
    return $catalog;
}

function fx_image_basename($path) {
    if (!$path) return '';
    $name = basename(strtok((string)$path, '?'));
    $dot = strrpos($name, '.');
    return $dot !== false ? substr($name, 0, $dot) : $name;
}

// ----------------------------------------------------------------------
// Location profiles — used to pick fake IPs and fake geo hints.
// Public IP ranges chosen to be plausible but not for spoofing.
// We use Cloudflare-style hashed sample addresses; admin can decide whether
// to enrich them via the dashboard.
// ----------------------------------------------------------------------
function fx_location_profiles() {
    return array(
        'portugal_lisbon' => array(
            'country' => 'Portugal', 'city' => 'Lisbon', 'region' => 'Lisbon',
            'lat' => 38.72, 'lon' => -9.13,
            'isp' => 'NOS Comunicacoes', 'asn' => 'AS2860',
            'tz' => 'Europe/Lisbon', 'lang' => 'pt-PT',
            'ip_pool' => array('85.243.10.', '188.250.55.', '193.137.91.'),
        ),
        'portugal_porto' => array(
            'country' => 'Portugal', 'city' => 'Porto', 'region' => 'Porto',
            'lat' => 41.15, 'lon' => -8.61,
            'isp' => 'MEO', 'asn' => 'AS3243',
            'tz' => 'Europe/Lisbon', 'lang' => 'pt-PT',
            'ip_pool' => array('46.50.20.', '85.246.30.'),
        ),
        'brazil' => array(
            'country' => 'Brazil', 'city' => 'São Paulo', 'region' => 'SP',
            'lat' => -23.55, 'lon' => -46.63,
            'isp' => 'Vivo Banda Larga', 'asn' => 'AS27699',
            'tz' => 'America/Sao_Paulo', 'lang' => 'pt-BR',
            'ip_pool' => array('177.43.5.', '189.6.20.', '200.150.180.'),
        ),
        'uk' => array(
            'country' => 'United Kingdom', 'city' => 'London', 'region' => 'England',
            'lat' => 51.51, 'lon' => -0.13,
            'isp' => 'BT', 'asn' => 'AS2856',
            'tz' => 'Europe/London', 'lang' => 'en-GB',
            'ip_pool' => array('86.140.10.', '90.200.30.'),
        ),
        'angola' => array(
            'country' => 'Angola', 'city' => 'Luanda', 'region' => 'Luanda',
            'lat' => -8.84, 'lon' => 13.23,
            'isp' => 'Unitel', 'asn' => 'AS37457',
            'tz' => 'Africa/Luanda', 'lang' => 'pt-AO',
            'ip_pool' => array('41.222.10.', '197.149.40.'),
        ),
        'france' => array(
            'country' => 'France', 'city' => 'Paris', 'region' => 'Île-de-France',
            'lat' => 48.85, 'lon' => 2.35,
            'isp' => 'Orange', 'asn' => 'AS3215',
            'tz' => 'Europe/Paris', 'lang' => 'fr-FR',
            'ip_pool' => array('90.84.20.', '92.140.55.'),
        ),
        'local_private' => array(
            'country' => '', 'city' => '', 'region' => '',
            'lat' => null, 'lon' => null,
            'isp' => '', 'asn' => '',
            'tz' => 'Europe/Lisbon', 'lang' => 'pt-PT',
            'ip_pool' => array('127.0.0.', '192.168.1.', '10.0.0.'),
        ),
    );
}

// ----------------------------------------------------------------------
// Source profiles
// ----------------------------------------------------------------------
function fx_source_profiles() {
    return array(
        'instagram' => array(
            'referrer' => 'https://www.instagram.com/',
            'first_referrer' => 'https://www.instagram.com/',
            'external_referrer' => 'https://www.instagram.com/',
            'referrer_type' => 'instagram',
            'utm_source' => 'instagram', 'utm_medium' => 'social', 'utm_campaign' => 'congresso_2026',
        ),
        'facebook' => array(
            'referrer' => 'https://www.facebook.com/',
            'first_referrer' => 'https://l.facebook.com/',
            'external_referrer' => 'https://l.facebook.com/',
            'referrer_type' => 'facebook',
            'utm_source' => 'facebook', 'utm_medium' => 'social', 'utm_campaign' => '',
        ),
        'whatsapp' => array(
            'referrer' => 'https://wa.me/',
            'first_referrer' => 'https://wa.me/',
            'external_referrer' => 'https://wa.me/',
            'referrer_type' => 'whatsapp',
            'utm_source' => '', 'utm_medium' => '', 'utm_campaign' => '',
        ),
        'google' => array(
            'referrer' => 'https://www.google.com/',
            'first_referrer' => 'https://www.google.com/search',
            'external_referrer' => 'https://www.google.com/search',
            'referrer_type' => 'google',
            'utm_source' => '', 'utm_medium' => '', 'utm_campaign' => '',
        ),
        'direct' => array(
            'referrer' => '', 'first_referrer' => '', 'external_referrer' => '',
            'referrer_type' => 'direct',
            'utm_source' => '', 'utm_medium' => '', 'utm_campaign' => '',
        ),
        'internal_admin' => array(
            'referrer' => 'http://localhost:8080/admin-funnel.php',
            'first_referrer' => 'http://localhost:8080/admin-funnel.php',
            'external_referrer' => '',  // stripped because internal
            'referrer_type' => 'internal_admin',
            'utm_source' => '', 'utm_medium' => '', 'utm_campaign' => '',
        ),
    );
}

// ----------------------------------------------------------------------
// Device profiles
// ----------------------------------------------------------------------
function fx_device_profiles() {
    return array(
        'mobile' => array(
            'device_type' => 'mobile',
            'viewports' => array(
                array(360, 800), array(375, 812), array(384, 854), array(390, 844),
                array(412, 892), array(428, 926),
            ),
            'screens' => array(array(360, 800), array(375, 812), array(390, 844), array(428, 926)),
            'dpr_pool' => array(2, 2.5, 3),
            'orientation_pool' => array('portrait-primary', 'portrait-primary', 'portrait-primary', 'landscape-primary'),
            'touch_pool' => array(5, 10),
            'conn_pool' => array('4g', '4g', '3g', '5g'),
        ),
        'desktop' => array(
            'device_type' => 'desktop',
            'viewports' => array(array(1366, 768), array(1440, 900), array(1552, 832), array(1920, 1080)),
            'screens' => array(array(1920, 1080), array(2560, 1440)),
            'dpr_pool' => array(1, 1.25, 1.5, 2),
            'orientation_pool' => array('landscape-primary'),
            'touch_pool' => array(0),
            'conn_pool' => array('4g'),
        ),
    );
}

// ----------------------------------------------------------------------
// Seeded randomness helpers
// ----------------------------------------------------------------------
function fx_pick(array $arr) {
    if (empty($arr)) return null;
    return $arr[mt_rand(0, count($arr) - 1)];
}
function fx_pick_weighted(array $weights) {
    // $weights is name => weight (int)
    $total = array_sum($weights);
    if ($total <= 0) return array_key_first($weights);
    $r = mt_rand(1, $total);
    foreach ($weights as $name => $w) {
        $r -= max(0, (int)$w);
        if ($r <= 0) return $name;
    }
    return array_key_last($weights);
}
function fx_short_id($prefix = '', $len = 10) {
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $s = '';
    for ($i = 0; $i < $len; $i++) $s .= $chars[mt_rand(0, strlen($chars) - 1)];
    return $prefix . $s;
}
function fx_iso_at_ms($ms) {
    return gmdate('Y-m-d\TH:i:s\Z', (int)floor($ms / 1000));
}

// ----------------------------------------------------------------------
// Build a session "envelope" — picks source/device/location/start time.
// ----------------------------------------------------------------------
function fx_make_envelope($date, $sourceKey, $deviceKey, $locationKey) {
    $sources = fx_source_profiles();
    $devices = fx_device_profiles();
    $locations = fx_location_profiles();

    $src = $sources[$sourceKey] ?? $sources['direct'];
    $dev = $devices[$deviceKey] ?? $devices['mobile'];
    $loc = $locations[$locationKey] ?? $locations['local_private'];

    $vp = fx_pick($dev['viewports']);
    $sc = fx_pick($dev['screens']);
    $dpr = fx_pick($dev['dpr_pool']);
    $orient = fx_pick($dev['orientation_pool']);
    $touch = fx_pick($dev['touch_pool']);
    $conn = fx_pick($dev['conn_pool']);

    // Random IP from pool (private locations use 127/192/10 prefixes)
    $ipPrefix = fx_pick($loc['ip_pool']);
    $ip = $ipPrefix . mt_rand(2, 250);

    // Start time anywhere in the day (UTC), biased toward business hours.
    $startTsBase = strtotime($date . 'T00:00:00Z');
    // Bias: 60% in 09:00-22:00, 40% elsewhere.
    if (mt_rand(0, 99) < 60) {
        $hour = 9 + mt_rand(0, 12);
    } else {
        $hour = mt_rand(0, 23);
    }
    $startMs = ($startTsBase + $hour * 3600 + mt_rand(0, 3599)) * 1000 + mt_rand(0, 999);

    return array(
        'source_key' => $sourceKey,
        'device_key' => $deviceKey,
        'location_key' => $locationKey,
        'ip' => $ip,
        'src' => $src,
        'dev' => $dev,
        'loc' => $loc,
        'viewport_width' => $vp[0], 'viewport_height' => $vp[1],
        'screen_width' => $sc[0], 'screen_height' => $sc[1],
        'device_pixel_ratio' => $dpr,
        'orientation' => $orient,
        'max_touch_points' => $touch,
        'connection_effective_type' => $conn,
        'save_data' => 0,
        'language' => $loc['lang'],
        'timezone' => $loc['tz'],
        'session_id' => 'mp' . fx_short_id('', 8) . '-' . fx_short_id('', 8),
        'page_instance_id' => fx_short_id('pg_', 8),
        'start_ms' => $startMs,
    );
}

// ----------------------------------------------------------------------
// Base event payload — every event includes these fields, matching the
// real implementation as closely as possible.
// ----------------------------------------------------------------------
function fx_base_event(array $env, $eventName, $tsMs, $cei, $secsSinceStart, $secsSincePrev) {
    return array(
        // Mandatory framing
        'session_id' => $env['session_id'],
        'event_name' => $eventName,
        'page_instance_id' => $env['page_instance_id'],
        'client_event_index' => $cei,
        'timestamp_ms' => $tsMs,
        // Device + viewport (extra context)
        'device_type' => $env['dev']['device_type'],
        'viewport_width' => $env['viewport_width'],
        'viewport_height' => $env['viewport_height'],
        'screen_width' => $env['screen_width'],
        'screen_height' => $env['screen_height'],
        'device_pixel_ratio' => $env['device_pixel_ratio'],
        'orientation' => $env['orientation'],
        'max_touch_points' => $env['max_touch_points'],
        'language' => $env['language'],
        'timezone' => $env['timezone'],
        'connection_effective_type' => $env['connection_effective_type'],
        'save_data' => $env['save_data'],
        // Timing
        'seconds_since_session_start' => $secsSinceStart,
        'seconds_since_previous_event' => $secsSincePrev,
        // Referrer / attribution
        'landing_page' => '',  // filled per-event by the journey
        'referrer' => $env['src']['referrer'],
        'first_landing_page' => '',  // filled later
        'first_referrer' => $env['src']['first_referrer'],
        'first_url' => '',
        'external_referrer' => $env['src']['external_referrer'],
        'referrer_type' => $env['src']['referrer_type'],
        'utm_source' => $env['src']['utm_source'],
        'utm_medium' => $env['src']['utm_medium'],
        'utm_campaign' => $env['src']['utm_campaign'],
        'is_visible' => 1,
    );
}

// ----------------------------------------------------------------------
// Generate one session's events from a behaviour profile or a scripted
// journey. Returns an array of "JSONL line" arrays.
// ----------------------------------------------------------------------
function fx_landing_page_for($productSlug) {
    if (!$productSlug || $productSlug === 'homepage_only') return '/index.html';
    return '/' . $productSlug . '.html';
}

function fx_step_index_for_product(array $catalog, $productSlug, $stepId) {
    if (!isset($catalog[$productSlug])) return 0;
    $i = 0;
    foreach ($catalog[$productSlug]['steps'] as $sid => $_) {
        if ($sid === $stepId) return $i;
        $i++;
    }
    return $i;
}

function fx_steps_for_product(array $catalog, $productSlug) {
    if (!isset($catalog[$productSlug])) return array();
    return array_keys($catalog[$productSlug]['steps']);
}

function fx_pick_item(array $catalog, $productSlug, $stepId) {
    if (!isset($catalog[$productSlug]['steps'][$stepId])) return null;
    $items = $catalog[$productSlug]['steps'][$stepId];
    if (empty($items)) return null;
    return fx_pick($items);
}

function fx_find_item_by_value(array $catalog, $productSlug, $stepId, $needle) {
    if (!isset($catalog[$productSlug]['steps'][$stepId])) return null;
    foreach ($catalog[$productSlug]['steps'][$stepId] as $it) {
        if ($it['value'] === $needle || $it['id'] === $needle) return $it;
    }
    return null;
}

function fx_build_snapshot_for_state(array $state) {
    $snap = array();
    if (!empty($state['selected_designs'])) {
        $snap['selected_designs'] = array_values($state['selected_designs']);
        $snap['selection_count'] = count($state['selected_designs']);
    }
    if (!empty($state['selected_cover'])) {
        $snap['selected_cover'] = $state['selected_cover'];
        if (!empty($state['selected_cover_title'])) $snap['selected_cover_title'] = $state['selected_cover_title'];
        if (empty($snap['selected_designs'])) {
            $snap['selected_designs'] = array($state['selected_cover']);
            $snap['selection_count'] = 1;
        }
    }
    if (!empty($state['lamination'])) $snap['lamination'] = $state['lamination'];
    if (!empty($state['selected_pack'])) $snap['selected_pack'] = (int)$state['selected_pack'];
    if (!empty($state['caderno_option'])) $snap['caderno_option'] = $state['caderno_option'];
    if (!empty($state['selected_size'])) $snap['selected_size'] = $state['selected_size'];
    if (isset($state['cover_personalization'])) $snap['cover_personalization'] = (int)!!$state['cover_personalization'];
    if (!empty($state['caderno_qty'])) $snap['caderno_qty'] = (int)$state['caderno_qty'];
    if (!empty($state['assorted'])) $snap['assorted'] = 1;
    if (!empty($state['selected_delivery'])) $snap['selected_delivery'] = $state['selected_delivery'];
    return $snap;
}

class FxJourneyBuilder {
    public $catalog;
    public $env;
    public $state = array();
    public $events = array();
    public $cei = 0;
    public $curMs;
    public $startMs;
    public $prevMs;
    public $curStep = '';
    public $curStepIndex = 0;
    public $productSlug;
    public $landingPage;
    public $firstLandingPage;
    public $strict = false;
    public $warnings = array();

    public function __construct(array $catalog, array $env, $productSlug, $strict = false) {
        $this->catalog = $catalog;
        $this->env = $env;
        $this->productSlug = $productSlug;
        $this->landingPage = fx_landing_page_for($productSlug);
        $this->firstLandingPage = $this->landingPage;
        $this->startMs = $env['start_ms'];
        $this->curMs = $this->startMs;
        $this->prevMs = $this->startMs;
        $this->strict = $strict;
    }

    public function emit($name, array $extras = array(), $secsAdvance = null) {
        if ($secsAdvance !== null) {
            $this->curMs += (int)($secsAdvance * 1000);
        }
        $this->cei++;
        $secsSinceStart = max(0, (int)round(($this->curMs - $this->startMs) / 1000));
        $secsSincePrev = max(0, (int)round(($this->curMs - $this->prevMs) / 1000));
        $base = fx_base_event($this->env, $name, $this->curMs, $this->cei, $secsSinceStart, $secsSincePrev);
        $base['landing_page'] = $this->landingPage;
        $base['first_landing_page'] = $this->firstLandingPage;
        $base['first_url'] = 'http://localhost:8080' . $this->firstLandingPage;
        if (in_array($name, array('step_view', 'step_completed', 'design_selected', 'design_unselected',
                                  'option_selected', 'selection_updated', 'step_selection_snapshot',
                                  'image_magnified', 'validation_error', 'order_submitted',
                                  'heartbeat', 'wizard_started', 'cart_order_submitted'), true)) {
            $base['product_slug'] = $this->productSlug ?: '';
            $base['product_type'] = $this->productSlug ?: '';
            if ($this->curStep) {
                $base['step_id'] = $this->curStep;
                $base['step_index'] = $this->curStepIndex;
            }
        }
        foreach ($extras as $k => $v) {
            if ($v === null || $v === '') continue;
            $base[$k] = $v;
        }
        // Compose final JSONL line (server-side wraps in {timestamp_iso, ip, skip_reason, ...cleaned}).
        $line = array(
            'timestamp_iso' => fx_iso_at_ms($this->curMs),
            'ip' => $this->env['ip'],
            'skip_reason' => '',
        );
        foreach ($base as $k => $v) {
            if ($v === '' || $v === null) continue;
            $line[$k] = $v;
        }
        // selection_snapshot mirror like the server does when selection_json is present
        if (isset($extras['selection_json']) && is_array($extras['selection_json'])) {
            $line['selection_snapshot'] = $extras['selection_json'];
        }
        $this->events[] = $line;
        $this->prevMs = $this->curMs;
    }

    public function advance($secs) { $this->curMs += (int)($secs * 1000); }

    public function goto_step($stepId, $transitionReason, $secsAdvance = 0.5) {
        $from = $this->curStep;
        $newIdx = fx_step_index_for_product($this->catalog, $this->productSlug, $stepId);
        $this->curStep = $stepId;
        $this->curStepIndex = $newIdx;
        $extras = array(
            'from_step' => $from,
            'to_step' => $stepId,
            'transition_reason' => $transitionReason,
        );
        // Include selection snapshot if we have any state
        $snap = fx_build_snapshot_for_state($this->state);
        if (!empty($snap)) $extras['selection_json'] = $snap;
        $this->emit('step_view', $extras, $secsAdvance);
    }

    public function step_completed($secsAdvance = 0.1) {
        $this->emit('step_completed', array(), $secsAdvance);
    }

    public function design_selected($designItem, $secsAdvance = null) {
        if (!$designItem) return;
        // Update state — assume multi unless product is cadernos
        if ($this->productSlug === 'cadernos') {
            $this->state['selected_designs'] = array($designItem['value']);
            $this->state['selected_cover'] = $designItem['value'];
            $this->state['selected_cover_title'] = $designItem['title'];
        } else {
            if (!isset($this->state['selected_designs'])) $this->state['selected_designs'] = array();
            if (!in_array($designItem['value'], $this->state['selected_designs'], true)) {
                $this->state['selected_designs'][] = $designItem['value'];
            }
        }
        $extras = array(
            'design_id' => $designItem['value'],
            'item_id' => $designItem['value'],
            'design_title' => $designItem['title'],
        );
        if ($designItem['image']) $extras['image_src'] = $designItem['image'];
        $extras['selection_json'] = fx_build_snapshot_for_state($this->state);
        $this->emit('design_selected', $extras, $secsAdvance ?? 0.3);
    }

    public function design_unselected($designItem, $secsAdvance = null) {
        if (!$designItem) return;
        if (isset($this->state['selected_designs'])) {
            $this->state['selected_designs'] = array_values(array_filter($this->state['selected_designs'], function ($v) use ($designItem) { return $v !== $designItem['value']; }));
        }
        $extras = array(
            'design_id' => $designItem['value'],
            'item_id' => $designItem['value'],
            'design_title' => $designItem['title'],
        );
        if ($designItem['image']) $extras['image_src'] = $designItem['image'];
        $extras['selection_json'] = fx_build_snapshot_for_state($this->state);
        $this->emit('design_unselected', $extras, $secsAdvance ?? 0.2);
    }

    public function option_selected($optType, $optValue, $optLabel = '', $secsAdvance = null) {
        // Update state
        switch ($optType) {
            case 'lamination': $this->state['lamination'] = $optValue; break;
            case 'pack': $this->state['selected_pack'] = is_numeric($optValue) ? (int)$optValue : $optValue; break;
            case 'purchase_option': $this->state['caderno_option'] = $optValue; break;
            case 'size': $this->state['selected_size'] = $optValue; break;
            case 'cover_personalization': $this->state['cover_personalization'] = ($optValue === 'yes' || $optValue === '1' || $optValue === 1); break;
            case 'delivery': $this->state['selected_delivery'] = $optValue; break;
            case 'caderno_qty': $this->state['caderno_qty'] = $optValue; break;
        }
        $extras = array(
            'option_type' => $optType,
            'option_value' => (string)$optValue,
        );
        if ($optLabel) $extras['option_label'] = $optLabel;
        $extras['selection_json'] = fx_build_snapshot_for_state($this->state);
        $this->emit('option_selected', $extras, $secsAdvance ?? 0.5);
    }

    public function image_magnified($designItem, $imageSlot = 'main', $secsAdvance = null) {
        if (!$designItem) return;
        $imagePath = $designItem['image'] ?: '';
        $basename = fx_image_basename($imagePath);
        $extras = array(
            'design_id' => $basename ?: $designItem['value'],
            'item_id' => $designItem['value'],
            'design_title' => $designItem['title'],
            'image_slot' => $imageSlot,
        );
        if ($imagePath) $extras['image_src'] = $imagePath;
        $extras['selection_json'] = fx_build_snapshot_for_state($this->state);
        $this->emit('image_magnified', $extras, $secsAdvance ?? 1.0);
    }

    public function heartbeat($secsAdvance = 45) {
        $this->emit('heartbeat', array(), $secsAdvance);
    }

    public function validation_error($errCount = 1, $secsAdvance = 0.3) {
        $extras = array(
            'transition_reason' => 'validation_failed',
            'validation_error_count' => $errCount,
        );
        $this->emit('validation_error', $extras, $secsAdvance);
    }

    public function order_submitted($secsAdvance = 1.0) {
        $extras = array();
        $snap = fx_build_snapshot_for_state($this->state);
        if (!empty($snap)) $extras['selection_json'] = $snap;
        $extras['step_id'] = 'submit';
        $this->emit('order_submitted', $extras, $secsAdvance);
    }

    public function site_landed($secsAdvance = 0) {
        $extras = array('page_load_type' => 'first_session_event');
        $this->emit('site_landed', $extras, $secsAdvance);
    }

    public function wizard_started($firstStepId = 'designs', $secsAdvance = 0.2) {
        $this->curStep = $firstStepId;
        $this->curStepIndex = fx_step_index_for_product($this->catalog, $this->productSlug, $firstStepId);
        $this->emit('wizard_started', array('step_id' => $firstStepId, 'step_index' => $this->curStepIndex), $secsAdvance);
    }

    public function ui_interaction($actionName, $targetLabel = '', $secsAdvance = 0.2) {
        $extras = array(
            'interaction_type' => 'click',
            'target_type' => 'button',
            'action_name' => $actionName,
        );
        if ($targetLabel) $extras['target_label'] = $targetLabel;
        $this->emit('ui_interaction', $extras, $secsAdvance);
    }

    public function abandon($secsAdvance = 30) {
        // No event — just advance time; the session ends without explicit marker.
        $this->advance($secsAdvance);
    }
}

// ----------------------------------------------------------------------
// Behaviour profiles — produce a journey for a given product + behaviour tag.
// ----------------------------------------------------------------------
function fx_journey_homepage_only(FxJourneyBuilder $b) {
    $b->landingPage = '/index.html';
    $b->firstLandingPage = '/index.html';
    $b->site_landed();
    if (mt_rand(0, 1)) $b->heartbeat(45);
    if (mt_rand(0, 2)) $b->ui_interaction('view_carousel', 'Próximo');
    $b->abandon(mt_rand(60, 240));
}

function fx_journey_abandoned_after_designs(FxJourneyBuilder $b) {
    $b->site_landed();
    $b->wizard_started('designs');
    $b->goto_step('designs', 'initial_load', mt_rand(2, 8));
    $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
    if (!empty($designs)) {
        $pick = fx_pick($designs);
        // Browse: maybe magnify, maybe select
        if (mt_rand(0, 2)) $b->image_magnified($pick, 'main', mt_rand(3, 15));
        if (mt_rand(0, 1)) $b->design_selected($pick, mt_rand(2, 10));
    }
    $b->abandon(mt_rand(60, 200));
}

function fx_journey_abandoned_after_options(FxJourneyBuilder $b) {
    $b->site_landed();
    $b->wizard_started('designs');
    $b->goto_step('designs', 'initial_load', mt_rand(2, 6));
    $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
    if (!empty($designs)) {
        $pick = fx_pick($designs);
        $b->design_selected($pick, mt_rand(3, 12));
        if (mt_rand(0, 1)) $b->image_magnified($pick, $b->productSlug === 'cadernos' ? 'cover' : 'main', mt_rand(2, 8));
    }
    $b->step_completed();
    $steps = fx_steps_for_product($b->catalog, $b->productSlug);
    $secondStep = null;
    foreach ($steps as $s) {
        if ($s !== 'designs' && in_array($s, array('lamination', 'size', 'pack'), true)) { $secondStep = $s; break; }
    }
    if ($secondStep) {
        $b->goto_step($secondStep, 'next_button', mt_rand(1, 4));
        $items = $b->catalog[$b->productSlug]['steps'][$secondStep] ?? array();
        if (!empty($items)) {
            $opt = fx_pick($items);
            $optType = $secondStep === 'lamination' ? 'lamination' : ($secondStep === 'size' ? 'size' : 'pack');
            $val = $secondStep === 'lamination' ? $opt['id'] : ($secondStep === 'pack' ? (int)str_replace('pack-', '', $opt['id']) ?: 1 : $opt['value']);
            $b->option_selected($optType, $val, $opt['title'], mt_rand(2, 8));
        }
    }
    $b->abandon(mt_rand(120, 600));
}

function fx_journey_selected_but_not_bought(FxJourneyBuilder $b) {
    fx_journey_full_browse($b, false);
}

function fx_journey_selected_and_bought(FxJourneyBuilder $b) {
    fx_journey_full_browse($b, true);
}

function fx_journey_full_browse(FxJourneyBuilder $b, $submitOrder) {
    $b->site_landed();
    $b->wizard_started('designs');
    $b->goto_step('designs', 'initial_load', mt_rand(3, 8));
    $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
    if (!empty($designs)) {
        $pick = fx_pick($designs);
        // multi-products select 1-3 designs
        if ($b->productSlug !== 'cadernos') {
            $count = mt_rand(1, min(3, count($designs)));
            $picked = array($pick);
            for ($i = 1; $i < $count; $i++) {
                $picked[] = $designs[($i * 3) % count($designs)];
            }
            foreach ($picked as $p) $b->design_selected($p, mt_rand(1, 4));
        } else {
            // single cover
            $b->design_selected($pick, mt_rand(2, 8));
            if (mt_rand(0, 1)) $b->image_magnified($pick, 'cover', mt_rand(2, 8));
        }
    }
    $b->step_completed();
    // Walk all remaining steps and pick options
    $steps = fx_steps_for_product($b->catalog, $b->productSlug);
    foreach ($steps as $s) {
        if ($s === 'designs' || $s === 'details' || $s === 'delivery_contact' || $s === 'confirm') continue;
        $b->goto_step($s, 'next_button', mt_rand(1, 5));
        $items = $b->catalog[$b->productSlug]['steps'][$s] ?? array();
        if (empty($items)) { $b->step_completed(); continue; }
        $opt = fx_pick($items);
        if ($s === 'lamination') {
            $b->option_selected('lamination', $opt['id'], $opt['title'], mt_rand(2, 8));
        } elseif ($s === 'pack') {
            if ($b->productSlug === 'cadernos') {
                $b->option_selected('purchase_option', $opt['id'], $opt['title'], mt_rand(2, 6));
            } else {
                $val = (int)str_replace('pack-', '', $opt['id']) ?: 1;
                $b->option_selected('pack', $val, $opt['title'], mt_rand(2, 6));
            }
        } elseif ($s === 'size') {
            $b->option_selected('size', $opt['value'], $opt['title'], mt_rand(2, 6));
        } elseif ($s === 'cover_personalization') {
            $val = mt_rand(0, 1) ? 'yes' : 'no';
            $b->option_selected('cover_personalization', $val, $val === 'yes' ? 'Sim, quero personalizar' : 'Não', mt_rand(2, 6));
        }
        $b->step_completed();
    }
    // contact + delivery + confirm
    if (in_array('details', $steps, true)) {
        $b->goto_step('details', 'next_button', mt_rand(2, 6));
        $b->advance(mt_rand(10, 30));  // pretend filling in (no PII fired)
        $b->step_completed();
    }
    if (in_array('delivery_contact', $steps, true)) {
        $b->goto_step('delivery_contact', 'next_button', mt_rand(1, 4));
        $b->option_selected('delivery', mt_rand(0, 1) ? 'ctt' : 'pickup', mt_rand(0, 1) ? 'CTT' : 'Levantamento', mt_rand(2, 6));
        $b->step_completed();
    }
    if (in_array('confirm', $steps, true)) {
        $b->goto_step('confirm', 'next_button', mt_rand(1, 3));
    }
    if ($submitOrder) {
        $b->order_submitted(mt_rand(1, 5));
    } else {
        $b->abandon(mt_rand(60, 200));
    }
}

function fx_journey_magnified_but_not_selected(FxJourneyBuilder $b) {
    $b->site_landed();
    $b->wizard_started('designs');
    $b->goto_step('designs', 'initial_load', mt_rand(2, 6));
    $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
    // Magnify a few but select none
    $n = min(3, count($designs));
    for ($i = 0; $i < $n; $i++) {
        $b->image_magnified($designs[$i], $b->productSlug === 'cadernos' ? 'cover' : 'main', mt_rand(3, 10));
    }
    $b->abandon(mt_rand(30, 90));
}

function fx_journey_backtracking(FxJourneyBuilder $b) {
    $b->site_landed();
    $b->wizard_started('designs');
    $b->goto_step('designs', 'initial_load', mt_rand(2, 5));
    $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
    if (empty($designs)) { $b->abandon(60); return; }
    $picked = fx_pick($designs);
    $b->design_selected($picked, mt_rand(2, 6));
    if (mt_rand(0, 1)) {
        $alt = $designs[(array_search($picked, $designs, true) + 1) % count($designs)];
        $b->design_unselected($picked, mt_rand(1, 3));
        $b->design_selected($alt, mt_rand(1, 4));
        $picked = $alt;
    }
    $b->step_completed();
    $steps = fx_steps_for_product($b->catalog, $b->productSlug);
    $optStep = null;
    foreach ($steps as $s) if (in_array($s, array('lamination','size','pack'), true)) { $optStep = $s; break; }
    if ($optStep) {
        $b->goto_step($optStep, 'next_button', mt_rand(1, 3));
        // Pick option then go BACK to designs
        $items = $b->catalog[$b->productSlug]['steps'][$optStep] ?? array();
        if (!empty($items)) {
            $opt = fx_pick($items);
            $optType = $optStep === 'lamination' ? 'lamination' : ($optStep === 'size' ? 'size' : 'pack');
            $val = $optStep === 'pack' ? ((int)str_replace('pack-', '', $opt['id']) ?: 1) : ($optStep === 'lamination' ? $opt['id'] : $opt['value']);
            $b->option_selected($optType, $val, $opt['title'], mt_rand(2, 6));
        }
        $b->goto_step('designs', 'back_button', mt_rand(1, 3));
    }
    $b->abandon(mt_rand(30, 90));
}

function fx_journey_validation_error(FxJourneyBuilder $b) {
    $b->site_landed();
    $b->wizard_started('designs');
    $b->goto_step('designs', 'initial_load', mt_rand(2, 6));
    // Try to advance without selecting → validation error
    $b->validation_error(1, mt_rand(2, 6));
    if (mt_rand(0, 1)) $b->validation_error(1, mt_rand(2, 4));
    $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
    if (!empty($designs)) {
        $b->design_selected(fx_pick($designs), mt_rand(2, 6));
    }
    $b->step_completed();
    $b->abandon(mt_rand(60, 180));
}

function fx_journey_heartbeat_heavy(FxJourneyBuilder $b) {
    $b->site_landed();
    if ($b->productSlug !== 'homepage_only') {
        $b->wizard_started('designs');
        $b->goto_step('designs', 'initial_load', mt_rand(2, 6));
        $designs = $b->catalog[$b->productSlug]['steps']['designs'] ?? array();
        if (!empty($designs)) $b->image_magnified(fx_pick($designs), 'main', mt_rand(5, 15));
    }
    // 5-8 heartbeats spaced ~45s apart
    $hb = mt_rand(5, 8);
    for ($i = 0; $i < $hb; $i++) {
        $b->heartbeat(45 + mt_rand(-5, 5));
    }
    $b->abandon(mt_rand(60, 120));
}

// ----------------------------------------------------------------------
// Scripted journey support
// ----------------------------------------------------------------------
function fx_run_scripted_journey(FxJourneyBuilder $b, array $journey) {
    $product = $b->productSlug;
    foreach ($journey as $step) {
        $step = trim((string)$step);
        if ($step === '') continue;
        switch ($step) {
            case 'site_landed':
                $b->site_landed();
                break;
            case 'product_opened':
                $b->wizard_started('designs');
                $b->goto_step('designs', 'initial_load', mt_rand(2, 5));
                break;
            case 'step_designs':
                $b->goto_step('designs', 'next_button', mt_rand(2, 5));
                break;
            case 'step_lamination':
                $b->goto_step('lamination', 'next_button', mt_rand(2, 5));
                break;
            case 'step_size':
                $b->goto_step('size', 'next_button', mt_rand(2, 5));
                break;
            case 'step_pack':
                $b->goto_step('pack', 'next_button', mt_rand(2, 5));
                break;
            case 'step_personalization':
                $b->goto_step('cover_personalization', 'next_button', mt_rand(2, 5));
                break;
            case 'step_contact':
                $b->goto_step('details', 'next_button', mt_rand(2, 5));
                break;
            case 'step_delivery':
                $b->goto_step('delivery_contact', 'next_button', mt_rand(2, 5));
                break;
            case 'step_confirm':
                $b->goto_step('confirm', 'next_button', mt_rand(2, 5));
                break;
            case 'design_selected':
                $designs = $b->catalog[$product]['steps']['designs'] ?? array();
                if (!empty($designs)) {
                    // Pick first not-yet-selected if multi
                    $candidate = null;
                    foreach ($designs as $d) {
                        if (empty($b->state['selected_designs']) || !in_array($d['value'], $b->state['selected_designs'], true)) {
                            $candidate = $d; break;
                        }
                    }
                    if (!$candidate) $candidate = fx_pick($designs);
                    $b->design_selected($candidate, mt_rand(2, 6));
                } elseif ($b->strict) {
                    throw new Exception("scripted step design_selected: no designs in product $product");
                } else {
                    $b->warnings[] = "design_selected skipped (no designs in $product)";
                }
                break;
            case 'design_unselected':
                if (!empty($b->state['selected_designs'])) {
                    $val = end($b->state['selected_designs']);
                    $item = fx_find_item_by_value($b->catalog, $product, 'designs', $val);
                    if ($item) $b->design_unselected($item, mt_rand(1, 3));
                }
                break;
            case 'image_magnified':
                $designs = $b->catalog[$product]['steps']['designs'] ?? array();
                if (!empty($designs)) {
                    // Prefer the currently selected one, else first
                    $candidate = null;
                    if (!empty($b->state['selected_designs'])) {
                        $candidate = fx_find_item_by_value($b->catalog, $product, 'designs', $b->state['selected_designs'][0]);
                    }
                    if (!$candidate) $candidate = $designs[0];
                    $slot = $product === 'cadernos' ? 'cover' : 'main';
                    $b->image_magnified($candidate, $slot, mt_rand(2, 6));
                } elseif ($b->strict) {
                    throw new Exception("scripted step image_magnified: no designs in product $product");
                } else {
                    $b->warnings[] = "image_magnified skipped (no designs in $product)";
                }
                break;
            case 'validation_error':
                $b->validation_error(1, mt_rand(1, 4));
                break;
            case 'heartbeat':
                $b->heartbeat(45);
                break;
            case 'order_submitted':
                $b->order_submitted(mt_rand(1, 4));
                break;
            case 'abandon':
                $b->abandon(mt_rand(60, 180));
                break;
            default:
                // option_TYPE_VALUE pattern
                if (preg_match('/^option_([a-z_]+)_(.+)$/', $step, $m)) {
                    $optType = $m[1]; $optTok = $m[2];
                    // Map common shorthand
                    $optionMap = array(
                        'lamination' => array('matte' => 'lamination-matte', 'glossy' => 'lamination-normal', 'normal' => 'lamination-normal',
                                              'glitter' => 'lamination-glitter-branco', 'glitter_branco' => 'lamination-glitter-branco', 'holografica' => 'lamination-holografica'),
                        'pack' => array('1' => 1, '3' => 3, '5' => 5, '10' => 10, '15' => 15, '24' => 24, 'normal' => 'caderno-normal', 'pioneiro' => 'caderno-pioneiro', 'pack_normal' => 'pack-normal', 'pack_pioneiro' => 'pack-pioneiro'),
                        'size' => array('25mm' => '25 mm', '32mm' => '32 mm', '25' => '25 mm', '32' => '32 mm', 'achatado' => 'Achatados', '3mm' => '3 mm'),
                        'personalization' => array('yes' => 'yes', 'no' => 'no'),
                        'delivery' => array('ctt' => 'ctt', 'pickup' => 'pickup'),
                    );
                    $val = isset($optionMap[$optType][$optTok]) ? $optionMap[$optType][$optTok] : $optTok;
                    $label = '';
                    if ($optType === 'lamination') {
                        // Resolve the title via catalog
                        $items = $b->catalog[$product]['steps']['lamination'] ?? array();
                        foreach ($items as $it) if ($it['id'] === $val) { $label = $it['title']; break; }
                    } elseif ($optType === 'pack' && $product === 'cadernos' && !is_int($val)) {
                        // map to purchase_option for cadernos
                        $items = $b->catalog['cadernos']['steps']['pack'] ?? array();
                        foreach ($items as $it) if ($it['id'] === $val) { $label = $it['title']; break; }
                        $b->option_selected('purchase_option', $val, $label, mt_rand(2, 5));
                        break;
                    }
                    $b->option_selected($optType, $val, $label, mt_rand(2, 5));
                } else {
                    if ($b->strict) throw new Exception("Unknown scripted step: $step");
                    $b->warnings[] = "Unknown step '$step' skipped";
                }
                break;
        }
    }
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------
$args = fx_parse_args($argv);

if (!empty($args['flags']['help'])) { fx_print_help(); exit(0); }
if (!empty($args['flags']['list-presets'])) {
    echo "Available presets:\n";
    foreach (array_keys(fx_presets()) as $p) echo "  $p\n";
    exit(0);
}

$defaults = fx_defaults();
$config = $defaults;

// Apply preset
if (!empty($args['opts']['preset'])) {
    $presetName = $args['opts']['preset'];
    $presets = fx_presets();
    if (!isset($presets[$presetName])) {
        fwrite(STDERR, "Unknown preset: $presetName. Use --list-presets to see options.\n");
        exit(2);
    }
    $config = fx_deep_merge($config, $presets[$presetName]);
    $config['_source_preset'] = $presetName;
}

// Apply config file
if (!empty($args['opts']['config'])) {
    $cfgPath = $args['opts']['config'];
    if (!is_file($cfgPath)) {
        fwrite(STDERR, "Config file not found: $cfgPath\n");
        exit(2);
    }
    $raw = file_get_contents($cfgPath);
    $cfg = json_decode($raw, true);
    if (!is_array($cfg)) {
        fwrite(STDERR, "Invalid JSON in config: $cfgPath\n");
        $err = json_last_error_msg();
        fwrite(STDERR, "  $err\n");
        exit(2);
    }
    $config = fx_deep_merge($config, $cfg);
    $config['_source_config'] = $cfgPath;
}

// Apply CLI overrides (highest priority)
foreach (array('date', 'output_dir', 'mode') as $k) {
    if (!empty($args['opts'][$k])) $config[$k] = $args['opts'][$k];
}
if (!empty($args['opts']['out'])) $config['output_dir'] = $args['opts']['out'];
if (isset($args['opts']['sessions'])) $config['sessions'] = (int)$args['opts']['sessions'];
if (isset($args['opts']['seed'])) $config['seed'] = (int)$args['opts']['seed'];
if (!empty($args['flags']['overwrite'])) $config['overwrite'] = true;
if (!empty($args['flags']['sqlite'])) $config['sqlite'] = true;
if (!empty($args['flags']['strict'])) $config['strict'] = true;

// Date validation
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $config['date'])) {
    fwrite(STDERR, "Invalid date: " . $config['date'] . "\n");
    exit(2);
}

// Seed
$seed = $config['seed'];
if ($seed === null) $seed = crc32($config['date']) & 0x7fffffff;
mt_srand($seed);

// Project root (worktree or main — anywhere this script is run from)
$projectRoot = realpath(__DIR__ . '/..');

// Output path
$outDir = $config['output_dir'];
if (!preg_match('#^[A-Za-z]:[\\\\/]#', $outDir) && substr($outDir, 0, 1) !== '/') {
    // Relative — anchor to project root for consistency
    $outDir = $projectRoot . DIRECTORY_SEPARATOR . $outDir;
}
if (!is_dir($outDir)) {
    @mkdir($outDir, 0700, true);
    if (!is_dir($outDir)) {
        fwrite(STDERR, "Cannot create output dir: $outDir\n");
        exit(2);
    }
}
$jsonlPath = $outDir . DIRECTORY_SEPARATOR . $config['date'] . '.jsonl';

if (file_exists($jsonlPath) && !$config['overwrite']) {
    fwrite(STDERR, "Output exists: $jsonlPath\nUse --overwrite to replace.\n");
    exit(3);
}

// Catalog
$catalog = fx_load_catalog($projectRoot);

// Decide which products this run covers — for the random portion.
$productPool = $config['products'];
$sourcePool = $config['traffic_sources'];
$devicePool = $config['devices'];
$locationPool = $config['map_locations'];

// Build session plan
$plan = array();

// 1. Scripted sessions take priority (1 entry each)
$scriptedWarnings = array();
foreach ($config['scripted_sessions'] as $scripted) {
    $plan[] = array('type' => 'scripted', 'spec' => $scripted);
}

// 2. Behaviour-tagged sessions
$behavBag = array();
foreach ($config['behaviours'] as $tag => $cnt) {
    for ($i = 0; $i < (int)$cnt; $i++) $behavBag[] = $tag;
}

$remaining = max(0, ((int)$config['sessions']) - count($plan));
// If behaviour bag is bigger than remaining, sample. If smaller, fill the rest with mixed_random.
shuffle($behavBag);
$behavTake = array_slice($behavBag, 0, $remaining);
foreach ($behavTake as $tag) {
    $plan[] = array('type' => 'behaviour', 'tag' => $tag);
}
$leftover = $remaining - count($behavTake);
for ($i = 0; $i < $leftover; $i++) {
    $plan[] = array('type' => 'behaviour', 'tag' => 'abandoned_after_designs');
}

// Generate
$allEvents = array();
$generatedCount = array('sessions' => 0, 'events' => 0);
$stats = array(
    'products' => array(),
    'sources' => array(),
    'devices' => array(),
    'locations' => array(),
    'submitted' => 0,
    'magnified_events' => 0,
    'selected_events' => 0,
    'abandoned' => 0,
);

foreach ($plan as $planEntry) {
    if ($planEntry['type'] === 'scripted') {
        $spec = $planEntry['spec'];
        $productSlug = $spec['product_slug'] ?? 'cadernos';
        $sourceKey = $spec['source'] ?? 'direct';
        $deviceKey = $spec['device'] ?? 'mobile';
        $locationKey = $spec['location'] ?? fx_pick_weighted($locationPool);
        $journey = $spec['journey'] ?? array();
        $env = fx_make_envelope($config['date'], $sourceKey, $deviceKey, $locationKey);
        if (isset($spec['start_time']) && preg_match('/^\d{2}:\d{2}/', $spec['start_time'])) {
            $env['start_ms'] = (strtotime($config['date'] . 'T' . substr($spec['start_time'], 0, 5) . ':00Z')) * 1000;
        }
        $b = new FxJourneyBuilder($catalog, $env, $productSlug, !empty($config['strict']));
        try {
            fx_run_scripted_journey($b, $journey);
        } catch (Exception $e) {
            fwrite(STDERR, "Scripted journey error (label='" . ($spec['label'] ?? '?') . "'): " . $e->getMessage() . "\n");
            if (!empty($config['strict'])) exit(4);
        }
        $allEvents = array_merge($allEvents, $b->events);
        if (!empty($b->warnings)) $scriptedWarnings = array_merge($scriptedWarnings, $b->warnings);
        $generatedCount['sessions']++;
        $generatedCount['events'] += count($b->events);
        $stats['products'][$productSlug] = ($stats['products'][$productSlug] ?? 0) + 1;
        $stats['sources'][$sourceKey] = ($stats['sources'][$sourceKey] ?? 0) + 1;
        $stats['devices'][$deviceKey] = ($stats['devices'][$deviceKey] ?? 0) + 1;
        $stats['locations'][$locationKey] = ($stats['locations'][$locationKey] ?? 0) + 1;
        foreach ($b->events as $ev) {
            if ($ev['event_name'] === 'order_submitted' || $ev['event_name'] === 'cart_order_submitted') $stats['submitted']++;
            if ($ev['event_name'] === 'image_magnified') $stats['magnified_events']++;
            if (in_array($ev['event_name'], array('design_selected', 'option_selected'), true)) $stats['selected_events']++;
        }
        continue;
    }
    // Behaviour-driven
    $tag = $planEntry['tag'];
    $productSlug = fx_pick_weighted($productPool);
    $sourceKey = fx_pick_weighted($sourcePool);
    $deviceKey = fx_pick_weighted($devicePool);
    $locationKey = fx_pick_weighted($locationPool);
    $isHome = ($productSlug === 'homepage_only');
    $env = fx_make_envelope($config['date'], $sourceKey, $deviceKey, $locationKey);
    $b = new FxJourneyBuilder($catalog, $env, $isHome ? '' : $productSlug, !empty($config['strict']));
    try {
        switch ($tag) {
            case 'submitted_orders':       fx_journey_selected_and_bought($b); break;
            case 'selected_and_bought':    fx_journey_selected_and_bought($b); break;
            case 'selected_but_not_bought':fx_journey_selected_but_not_bought($b); break;
            case 'abandoned_after_designs':$isHome ? fx_journey_homepage_only($b) : fx_journey_abandoned_after_designs($b); break;
            case 'abandoned_after_options':$isHome ? fx_journey_homepage_only($b) : fx_journey_abandoned_after_options($b); break;
            case 'magnified_but_not_selected': $isHome ? fx_journey_homepage_only($b) : fx_journey_magnified_but_not_selected($b); break;
            case 'backtracking_sessions':  $isHome ? fx_journey_homepage_only($b) : fx_journey_backtracking($b); break;
            case 'validation_error_sessions': $isHome ? fx_journey_homepage_only($b) : fx_journey_validation_error($b); break;
            case 'heartbeat_heavy_sessions': fx_journey_heartbeat_heavy($b); break;
            default: $isHome ? fx_journey_homepage_only($b) : fx_journey_abandoned_after_designs($b); break;
        }
    } catch (Exception $e) {
        fwrite(STDERR, "Behaviour journey '$tag' failed: " . $e->getMessage() . "\n");
        continue;
    }
    $allEvents = array_merge($allEvents, $b->events);
    $generatedCount['sessions']++;
    $generatedCount['events'] += count($b->events);
    $stats['products'][$productSlug] = ($stats['products'][$productSlug] ?? 0) + 1;
    $stats['sources'][$sourceKey] = ($stats['sources'][$sourceKey] ?? 0) + 1;
    $stats['devices'][$deviceKey] = ($stats['devices'][$deviceKey] ?? 0) + 1;
    $stats['locations'][$locationKey] = ($stats['locations'][$locationKey] ?? 0) + 1;
    $foundOrder = false;
    foreach ($b->events as $ev) {
        if ($ev['event_name'] === 'order_submitted' || $ev['event_name'] === 'cart_order_submitted') { $stats['submitted']++; $foundOrder = true; }
        if ($ev['event_name'] === 'image_magnified') $stats['magnified_events']++;
        if (in_array($ev['event_name'], array('design_selected', 'option_selected'), true)) $stats['selected_events']++;
    }
    if (!$foundOrder) $stats['abandoned']++;
}

// Sort all events globally by (timestamp_ms, client_event_index)
usort($allEvents, function ($a, $b) {
    $am = $a['timestamp_ms'] ?? 0; $bm = $b['timestamp_ms'] ?? 0;
    if ($am !== $bm) return $am - $bm;
    return ($a['client_event_index'] ?? 0) - ($b['client_event_index'] ?? 0);
});

// PII safety re-check
$bannedKeys = array('name','customer_name','card_name','email','customer_email','contact_email','copy_email','phone','customer_phone','contact_phone','customer_contact','card_contact','address','shipping_address','billing_address','congregation','church','message','note','notes','comment','comments','personalization_text','personalisation_text','cover_personalization_text','personalization_phrase','custom_text','typed_text','free_text');
$piiFound = array();
function fx_pii_scan(&$found, $banned, $obj, $path = '') {
    if (is_array($obj)) {
        foreach ($obj as $k => $v) {
            if (is_string($k) && in_array(strtolower($k), $banned, true)) {
                $found[] = "$path/$k";
            }
            fx_pii_scan($found, $banned, $v, $path . '/' . $k);
        }
    }
}
foreach ($allEvents as $i => $ev) fx_pii_scan($piiFound, $bannedKeys, $ev, '#' . $i);

if (!empty($piiFound)) {
    fwrite(STDERR, "PII KEYS DETECTED IN OUTPUT (refusing to write):\n");
    foreach (array_slice($piiFound, 0, 10) as $p) fwrite(STDERR, "  $p\n");
    exit(5);
}

// Write JSONL
$bytes = 0;
$fp = fopen($jsonlPath, 'w');
if (!$fp) { fwrite(STDERR, "Cannot open output: $jsonlPath\n"); exit(2); }
foreach ($allEvents as $ev) {
    $line = json_encode($ev, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) continue;
    fwrite($fp, $line . "\n");
    $bytes += strlen($line) + 1;
}
fclose($fp);
@chmod($jsonlPath, 0600);

// Optional SQLite + drop-in private dir
$sqliteInfo = null;
if (!empty($config['sqlite'])) {
    $fakePrivate = $projectRoot . DIRECTORY_SEPARATOR . 'local-test-data' . DIRECTORY_SEPARATOR . 'fake-private';
    @mkdir($fakePrivate, 0700, true);
    @mkdir($fakePrivate . DIRECTORY_SEPARATOR . 'funnel-jsonl', 0700, true);
    $sqlitePath = $fakePrivate . DIRECTORY_SEPARATOR . 'miaandpaper.sqlite';
    if (file_exists($sqlitePath) && !$config['overwrite']) {
        fwrite(STDERR, "Fake SQLite exists: $sqlitePath\nUse --overwrite to replace.\n");
        exit(3);
    }
    @unlink($sqlitePath);
    try {
        $pdo = new PDO('sqlite:' . $sqlitePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        // Minimal schema mirror — enough for the dashboard to read.
        $pdo->exec("CREATE TABLE funnel_events (
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
            event_json TEXT NOT NULL,
            selection_json TEXT,
            first_referrer TEXT,
            utm_source TEXT
        )");
        $pdo->exec("CREATE INDEX idx_funnel_session ON funnel_events (session_id, created_at)");
        $pdo->exec("CREATE INDEX idx_funnel_event ON funnel_events (event_name, created_at)");
        $pdo->exec("CREATE INDEX idx_funnel_product ON funnel_events (product_slug, created_at)");
        $pdo->exec("CREATE TABLE tracking_ignore_ips (ip TEXT PRIMARY KEY, label TEXT, created_at TEXT NOT NULL)");
        $pdo->exec("CREATE TABLE ip_lookup_cache (ip TEXT PRIMARY KEY, country_code TEXT, country_name TEXT, region TEXT, city TEXT, latitude REAL, longitude REAL, isp TEXT, org TEXT, asn TEXT, network_name TEXT, rdap_url TEXT, abuse_email TEXT, reverse_dns TEXT, is_hosting_guess INTEGER, source TEXT, raw_json TEXT, last_checked_at TEXT, lookup_error TEXT)");
        $pdo->exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
        // Mark all real migrations as applied so the live code doesn't try to run them.
        $migrationIds = array(
            '2026-05-11_init_orders','2026-05-11_init_order_events','2026-05-11_init_funnel_events',
            '2026-05-11_init_admin_login_attempts','2026-05-11_init_email_log',
            '2026-05-11_idx_orders','2026-05-11_idx_orders_contact','2026-05-11_idx_orders_ip',
            '2026-05-11_idx_funnel_session','2026-05-11_idx_funnel_event','2026-05-11_idx_funnel_product',
            '2026-05-11_init_tracking_ignore_ips','2026-05-11_init_funnel_events_archive',
            '2026-05-11_idx_funnel_ip_created','2026-05-11_idx_funnel_archive_ip',
            '2026-05-12_seed_tracking_ignore_ips_launch',
            '2026-05-16_add_funnel_selection_json','2026-05-16_add_funnel_archive_selection_json',
            '2026-05-16_add_funnel_first_referrer','2026-05-16_add_funnel_utm_source',
            '2026-05-16_init_ip_lookup_cache','2026-05-16_idx_ip_lookup_country',
        );
        // Create the missing tables the real schema would have (orders, etc.) — empty.
        $pdo->exec("CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, source TEXT, product_slug TEXT, product_type TEXT, customer_name TEXT, customer_contact TEXT, contact_email TEXT, contact_phone TEXT, card_name TEXT, card_contact TEXT, congregation TEXT, delivery_option TEXT, delivery_label TEXT, subtotal_cents INTEGER, shipping_estimate_cents INTEGER, total_estimate_cents INTEGER, currency TEXT, payment_status TEXT, paid INTEGER, paid_at TEXT, fulfillment_status TEXT, shipped_at TEXT, tracking_number TEXT, admin_notes TEXT, ip_number TEXT, ip_prefix TEXT, ip_hash TEXT, device_type TEXT, viewport_width INTEGER, landing_page TEXT, referrer TEXT, raw_order_json TEXT NOT NULL)");
        $pdo->exec("CREATE TABLE order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, created_at TEXT NOT NULL, event_type TEXT NOT NULL, event_data_json TEXT)");
        $pdo->exec("CREATE TABLE admin_login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, ip_number TEXT, user_agent TEXT, attempt_type TEXT, input_text TEXT)");
        $pdo->exec("CREATE TABLE email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, created_at TEXT NOT NULL, email_type TEXT, recipient TEXT, subject TEXT, success INTEGER, error_message TEXT)");
        $pdo->exec("CREATE TABLE funnel_events_archive (id INTEGER PRIMARY KEY AUTOINCREMENT, archived_at TEXT NOT NULL, archive_reason TEXT, original_id INTEGER, created_at TEXT NOT NULL, session_id TEXT, product_slug TEXT, product_type TEXT, event_name TEXT, step_id TEXT, step_index INTEGER, device_type TEXT, viewport_width INTEGER, viewport_height INTEGER, screen_width INTEGER, screen_height INTEGER, device_pixel_ratio REAL, orientation TEXT, ip_number TEXT, event_json TEXT NOT NULL, selection_json TEXT)");
        $stmt = $pdo->prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
        foreach ($migrationIds as $mid) $stmt->execute(array($mid, gmdate('Y-m-d\TH:i:s\Z')));

        // Insert all events
        $ins = $pdo->prepare("INSERT INTO funnel_events
            (created_at, session_id, product_slug, product_type, event_name, step_id, step_index,
             device_type, viewport_width, viewport_height, screen_width, screen_height, device_pixel_ratio,
             orientation, ip_number, event_json, selection_json, first_referrer, utm_source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $pdo->beginTransaction();
        $inserted = 0;
        foreach ($allEvents as $ev) {
            $selectionJson = null;
            if (isset($ev['selection_snapshot']) && is_array($ev['selection_snapshot'])) {
                $selectionJson = json_encode($ev['selection_snapshot'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            $ins->execute(array(
                $ev['timestamp_iso'] ?? gmdate('Y-m-d\TH:i:s\Z'),
                $ev['session_id'] ?? null,
                $ev['product_slug'] ?? null,
                $ev['product_type'] ?? null,
                $ev['event_name'] ?? null,
                $ev['step_id'] ?? null,
                isset($ev['step_index']) ? (int)$ev['step_index'] : null,
                $ev['device_type'] ?? null,
                isset($ev['viewport_width']) ? (int)$ev['viewport_width'] : null,
                isset($ev['viewport_height']) ? (int)$ev['viewport_height'] : null,
                isset($ev['screen_width']) ? (int)$ev['screen_width'] : null,
                isset($ev['screen_height']) ? (int)$ev['screen_height'] : null,
                isset($ev['device_pixel_ratio']) ? (float)$ev['device_pixel_ratio'] : null,
                $ev['orientation'] ?? null,
                $ev['ip'] ?? null,
                json_encode($ev, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $selectionJson,
                $ev['first_referrer'] ?? null,
                $ev['utm_source'] ?? null,
            ));
            $inserted++;
        }
        $pdo->commit();
        @chmod($sqlitePath, 0600);

        // Mirror JSONL into fake-private/funnel-jsonl/ (so live dashboard's JSONL panel sees it)
        $mirrorPath = $fakePrivate . DIRECTORY_SEPARATOR . 'funnel-jsonl' . DIRECTORY_SEPARATOR . $config['date'] . '.jsonl';
        @copy($jsonlPath, $mirrorPath);
        @chmod($mirrorPath, 0600);
        // Legacy single JSONL
        @copy($jsonlPath, $fakePrivate . DIRECTORY_SEPARATOR . 'order-funnel-events.jsonl');
        @chmod($fakePrivate . DIRECTORY_SEPARATOR . 'order-funnel-events.jsonl', 0600);

        // admin.php with password "fixture" so the user can log in
        $adminPath = $fakePrivate . DIRECTORY_SEPARATOR . 'admin.php';
        $hash = password_hash('fixture', PASSWORD_DEFAULT);
        $adminContent = "<?php\nreturn array(\n    'admin_password_hash' => '" . addslashes($hash) . "',\n);\n";
        @file_put_contents($adminPath, $adminContent);
        @chmod($adminPath, 0600);

        $sqliteInfo = array(
            'path' => $sqlitePath,
            'rows_inserted' => $inserted,
            'private_dir' => $fakePrivate,
            'admin_password' => 'fixture',
        );
    } catch (Exception $e) {
        fwrite(STDERR, "SQLite write failed: " . $e->getMessage() . "\n");
    }
}

// Validation
$validationErrors = array();
$lineNo = 0;
foreach ($allEvents as $ev) {
    $lineNo++;
    if (empty($ev['timestamp_iso'])) $validationErrors[] = "line $lineNo missing timestamp_iso";
    if (empty($ev['session_id'])) $validationErrors[] = "line $lineNo missing session_id";
    if (empty($ev['event_name'])) $validationErrors[] = "line $lineNo missing event_name";
}
$prev = 0;
$lineNo = 0;
foreach ($allEvents as $ev) {
    $lineNo++;
    $t = $ev['timestamp_ms'] ?? 0;
    if ($t < $prev) { $validationErrors[] = "line $lineNo out of time order"; break; }
    $prev = $t;
}

// Summary
$srcUsed = $config['_source_preset'] ?? ($config['_source_config'] ?? 'defaults');
$mode = !empty($args['opts']['config']) ? 'config' : (!empty($args['opts']['preset']) ? 'preset' : 'random');

echo "\n";
echo "═══════════════════════════════════════════════════════════════════\n";
echo "  Fake funnel day generated\n";
echo "═══════════════════════════════════════════════════════════════════\n";
echo "  Mode               : $mode" . ($mode === 'preset' ? " ({$srcUsed})" : '') . "\n";
echo "  Date               : " . $config['date'] . "\n";
echo "  Seed               : $seed\n";
echo "  JSONL output       : $jsonlPath\n";
echo "  Bytes              : " . number_format($bytes) . "\n";
echo "  Sessions           : " . $generatedCount['sessions'] . "\n";
echo "  Events             : " . $generatedCount['events'] . "\n";
echo "  Submitted orders   : " . $stats['submitted'] . "\n";
echo "  Abandoned sessions : " . $stats['abandoned'] . "\n";
echo "  Magnifier events   : " . $stats['magnified_events'] . "\n";
echo "  Select-type events : " . $stats['selected_events'] . "\n";
echo "  Products covered   : ";
$prodLine = array();
foreach ($stats['products'] as $p => $c) $prodLine[] = "$p:$c";
echo implode(', ', $prodLine) . "\n";
echo "  Sources            : ";
$srcLine = array();
foreach ($stats['sources'] as $s => $c) $srcLine[] = "$s:$c";
echo implode(', ', $srcLine) . "\n";
echo "  Devices            : ";
$devLine = array();
foreach ($stats['devices'] as $d => $c) $devLine[] = "$d:$c";
echo implode(', ', $devLine) . "\n";
echo "  Map locations      : ";
$locLine = array();
foreach ($stats['locations'] as $l => $c) $locLine[] = "$l:$c";
echo implode(', ', $locLine) . "\n";

if (!empty($scriptedWarnings)) {
    echo "\n  Scripted-journey warnings:\n";
    foreach (array_slice($scriptedWarnings, 0, 10) as $w) echo "    - $w\n";
}
if (!empty($validationErrors)) {
    echo "\n  Validation issues (output written anyway):\n";
    foreach (array_slice($validationErrors, 0, 10) as $w) echo "    - $w\n";
}

if ($sqliteInfo) {
    echo "\n  ─── Fake drop-in private dir ────────────────────────────────────\n";
    echo "  SQLite             : " . $sqliteInfo['path'] . "\n";
    echo "  Rows inserted      : " . $sqliteInfo['rows_inserted'] . "\n";
    echo "  Fake private dir   : " . $sqliteInfo['private_dir'] . "\n";
    echo "  Admin password     : " . $sqliteInfo['admin_password'] . "\n";
    echo "\n  To test in the live dashboard:\n";
    echo "    MIAANDPAPER_PRIVATE_DIR=" . str_replace($projectRoot . DIRECTORY_SEPARATOR, '', $sqliteInfo['private_dir']) . " php -S 127.0.0.1:8080 -t site\n";
    echo "    Open  http://127.0.0.1:8080/index.html\n";
    echo "    Login with password '" . $sqliteInfo['admin_password'] . "'\n";
    echo "    Open  http://127.0.0.1:8080/admin-live-dashboard.php\n";
} else {
    echo "\n  (Pass --sqlite to also generate a drop-in fake private dir for the live dashboard)\n";
}

echo "\n  Next:\n";
echo "    php tools/preview-fake-funnel-day.php --date=" . $config['date'] . "    # CLI preview\n";
echo "    php tools/generate-fake-funnel-day.php --config=tools/funnel-fixture-config.example.json --overwrite\n";
echo "    php tools/generate-fake-funnel-day.php --preset=busy-day --sqlite --overwrite\n";
echo "\n";

exit(0);
