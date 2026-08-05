cd /d "F:\Projects\miaandpaper-site"
set "MIAANDPAPER_PRIVATE_DIR=F:\Projects\miaandpaper-site\local-test-data\fake-private"
rem -d ... : o cli-server ignora site\.user.ini. Ver start-lan.bat.
php -d upload_max_filesize=44M -d post_max_size=48M -d max_file_uploads=10 -d max_input_time=300 -S 127.0.0.1:8080 -t site