FROM php:8.3-apache

RUN docker-php-ext-install mysqli \
    && printf '%s\n' 'session.cookie_secure=1' 'session.cookie_httponly=1' 'session.cookie_samesite=Lax' \
       > /usr/local/etc/php/conf.d/session-security.ini

WORKDIR /var/www/html
COPY . /var/www/html/backend/

EXPOSE 80
