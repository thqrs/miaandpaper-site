# Local admin

This repo can run the Mia & Paper admin locally without the production cPanel private folder.

## Requirements

- PHP CLI installed and available as `php`.
- No real production credentials in this repo.

## Create a local admin password

Generate a password hash:

```bat
php -r "echo password_hash('local-password-here', PASSWORD_DEFAULT), PHP_EOL;"
```

Create `private-local/admin.php`:

```php
<?php
return [
    'admin_password_hash' => 'PUT_LOCAL_HASH_HERE',
];
```

The `private-local/` folder is ignored by Git.

## Optional local mail config

For form/mail testing, create `private-local/mail.php`:

```php
<?php
return [
    'to' => 'you@example.test',
    'from' => 'no-reply@miaandpaper.com',
];
```

The local mail config can also use the legacy combined filename `private-local/miaandpaper-mail-config.php` if needed.

## Run locally

From the repo root:

```bat
run-local-admin.bat
```

Open:

```text
http://127.0.0.1:8000
```

Log into admin with the password used to generate `private-local/admin.php`.

## Path behaviour

`run-local-admin.bat` sets `MIAANDPAPER_PRIVATE_DIR` to `private-local/`. SQLite, admin logs, funnel JSONL fallback files, sync flags, backups, and local admin config are stored there.

Without `MIAANDPAPER_PRIVATE_DIR`, the site keeps the production cPanel layout and resolves private files through the private folder parallel to the deployed site root. `MIAANDPAPER_MAIL_CONFIG` still overrides the mail config path when it is set.
