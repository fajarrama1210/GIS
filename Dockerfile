FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL=/backend/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM php:8.3-apache

RUN docker-php-ext-install mysqli \
    && a2enmod rewrite \
    && printf '%s\n' \
       '<Directory /var/www/html>' \
       '    AllowOverride All' \
       '    Require all granted' \
       '</Directory>' \
       > /etc/apache2/conf-available/app-directory.conf \
    && a2enconf app-directory \
    && printf '%s\n' \
       'session.cookie_secure=1' \
       'session.cookie_httponly=1' \
       'session.cookie_samesite=Lax' \
       > /usr/local/etc/php/conf.d/session-security.ini

WORKDIR /var/www/html

COPY --from=frontend-build /app/dist/ ./
COPY backend/ ./backend/
COPY .htaccess ./

EXPOSE 80
