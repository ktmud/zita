FROM python:3.7.4-buster
RUN pip install --upgrade pip
COPY python/requirements.txt /app/python/
RUN pip install --no-deps -r /app/python/requirements.txt

# Install node prereqs, nodejs and yarn
# Ref: https://deb.nodesource.com/setup_10.x
# Ref: https://yarnpkg.com/en/docs/install
RUN \
  apt-get update && \
  apt-get install -yqq apt-transport-https
RUN \
  echo "deb https://deb.nodesource.com/node_10.x stretch main" > /etc/apt/sources.list.d/nodesource.list && \
  wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list && \
  wget -qO- https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  apt-get update && \
  apt-get install -yqq nodejs yarn && \
  npm i -g npm@^6 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm install

COPY static     /app/static
COPY server     /app/server
COPY pages      /app/pages
COPY lib        /app/lib
COPY components /app/components
COPY styles     /app/styles
COPY .babelrc next.config.js /app/
RUN npm run build

COPY python     /app/python
COPY server.js Procfile CHECKS entrypoint.sh /app/

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD ["web"]
