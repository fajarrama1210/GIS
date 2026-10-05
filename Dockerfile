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
       'upload_max_filesize=5M' \
       'post_max_size=6M' \
       > /usr/local/etc/php/conf.d/session-security.ini

WORKDIR /var/www/html

COPY --from=frontend-build /app/dist/ ./
COPY backend/ ./backend/
RUN mkdir -p /var/www/html/backend/uploads/team \
    && chown -R www-data:www-data /var/www/html/backend/uploads
COPY .htaccess ./

# Env vars runtime — di-set dari Dokploy/docker run -e
ARG BPS_API_KEY=""
ARG MYSQL_HOST=""
ARG MYSQL_PORT="3306"
ARG MYSQL_DATABASE="jember_db"
ARG MYSQL_USER=""
ARG MYSQL_PASSWORD=""
ENV BPS_API_KEY=${BPS_API_KEY}
ENV MYSQL_HOST=${MYSQL_HOST}
ENV MYSQL_PORT=${MYSQL_PORT}
ENV MYSQL_DATABASE=${MYSQL_DATABASE}
ENV MYSQL_USER=${MYSQL_USER}
ENV MYSQL_PASSWORD=${MYSQL_PASSWORD}

EXPOSE 80
