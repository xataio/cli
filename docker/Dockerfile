FROM debian:bookworm-slim

ARG POSTGRES_VERSION=18
ARG XATA_VERSION=latest

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    perl \
    gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/postgresql.list \
    && apt-get update && apt-get install -y postgresql-client-${POSTGRES_VERSION} \
    && rm -rf /var/lib/apt/lists/*

# Using the released remote CLI: this image is for async tasks and does not block CI
RUN if [ "$XATA_VERSION" = "latest" ]; then \
        curl -fsSL https://xata.io/install.sh | bash; \
    else \
        curl -fsSL https://xata.io/install.sh | VERSION=$XATA_VERSION bash; \
    fi

RUN chmod +x /root/.config/xata/bin/xata && cp /root/.config/xata/bin/xata /usr/local/bin/xata

RUN useradd -m -s /bin/bash xata

USER xata
WORKDIR /home/xata

ENTRYPOINT ["xata"]
CMD ["--help"]