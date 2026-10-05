FROM php:8.3-apache

RUN docker-php-ext-install mysqli \
    && printf '%s\n' 'session.cookie_secure=1' 'session.cookie_httponly=1' 'session.cookie_samesite=Lax' 'upload_max_filesize=5M' 'post_max_size=6M' \
       > /usr/local/etc/php/conf.d/session-security.ini

WORKDIR /var/www/html
COPY . /var/www/html/backend/
RUN mkdir -p /var/www/html/backend/uploads/team \
    && chown -R www-data:www-data /var/www/html/backend/uploads

EXPOSE 80
