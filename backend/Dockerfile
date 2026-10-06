FROM php:8.3-apache

RUN docker-php-ext-install mysqli opcache \
    && a2enmod deflate headers rewrite \
    && printf '%s\n' \
       'session.cookie_secure=1' \
       'session.cookie_httponly=1' \
       'session.cookie_samesite=Lax' \
       'upload_max_filesize=5M' \
       'post_max_size=6M' \
       > /usr/local/etc/php/conf.d/session-security.ini \
    && printf '%s\n' \
       'opcache.enable=1' \
       'opcache.memory_consumption=128' \
       'opcache.interned_strings_buffer=8' \
       'opcache.max_accelerated_files=4000' \
       'opcache.revalidate_freq=60' \
       'opcache.fast_shutdown=1' \
       > /usr/local/etc/php/conf.d/opcache.ini

# Enable gzip compression untuk Apache responses
RUN printf '%s\n' \
    '<IfModule mod_deflate.c>' \
    '  AddOutputFilterByType DEFLATE application/json' \
    '  AddOutputFilterByType DEFLATE application/javascript' \
    '  AddOutputFilterByType DEFLATE text/css text/html' \
    '</IfModule>' \
    > /etc/apache2/conf-available/gzip.conf \
    && a2enconf gzip

WORKDIR /var/www/html
COPY . /var/www/html/backend/
RUN mkdir -p /var/www/html/backend/uploads/team \
    && chown -R www-data:www-data /var/www/html/backend/uploads

EXPOSE 80
