<?php
/**
 * Central resolver for private files used by Mia & Paper.
 *
 * Local development can set MIAANDPAPER_PRIVATE_DIR to a repo-local folder.
 * Production falls back to the private directory parallel to the deployed site
 * root, which keeps the current cPanel layout working.
 */

if (!defined('MIAANDPAPER_PRIVATE_PATHS_LOADED')) {
    define('MIAANDPAPER_PRIVATE_PATHS_LOADED', true);

    function mp_private_env_value($name)
    {
        $value = getenv($name);
        if (!is_string($value)) {
            return '';
        }
        return trim($value);
    }

    function mp_private_dir_is_explicit()
    {
        return mp_private_env_value('MIAANDPAPER_PRIVATE_DIR') !== '';
    }

    function mp_private_dir()
    {
        $env = mp_private_env_value('MIAANDPAPER_PRIVATE_DIR');
        if ($env !== '') {
            $dir = rtrim($env, "\\/");
            if (!is_dir($dir)) {
                @mkdir($dir, 0700, true);
            }
            return is_dir($dir) ? $dir : null;
        }

        $dir = __DIR__ . '/../../private';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        return is_dir($dir) ? $dir : null;
    }

    function mp_private_path($filename)
    {
        $dir = mp_private_dir();
        if ($dir === null) {
            return null;
        }

        $relative = str_replace(array('/', '\\'), DIRECTORY_SEPARATOR, ltrim((string)$filename, "\\/"));
        if ($relative === '') {
            return rtrim($dir, "\\/");
        }

        return rtrim($dir, "\\/") . DIRECTORY_SEPARATOR . $relative;
    }

    function mp_private_mail_config_path()
    {
        $env = mp_private_env_value('MIAANDPAPER_MAIL_CONFIG');
        if ($env !== '') {
            return $env;
        }

        $mail = mp_private_path('mail.php');
        $combined = mp_private_path('miaandpaper-mail-config.php');

        if (mp_private_dir_is_explicit()) {
            if ($mail !== null && is_file($mail)) {
                return $mail;
            }
            if ($combined !== null && is_file($combined)) {
                return $combined;
            }
            return $mail;
        }

        if ($combined !== null && is_file($combined)) {
            return $combined;
        }
        if ($mail !== null && is_file($mail)) {
            return $mail;
        }
        return $combined;
    }

    function mp_private_admin_config_path()
    {
        $admin = mp_private_path('admin.php');
        $combined = mp_private_path('miaandpaper-mail-config.php');
        $mailEnv = mp_private_env_value('MIAANDPAPER_MAIL_CONFIG');

        if ($admin !== null && is_file($admin)) {
            return $admin;
        }
        if ($mailEnv !== '' && is_file($mailEnv)) {
            return $mailEnv;
        }
        if ($combined !== null && is_file($combined)) {
            return $combined;
        }

        if (mp_private_dir_is_explicit()) {
            return $admin;
        }
        if ($mailEnv !== '') {
            return $mailEnv;
        }
        return $combined;
    }
}
