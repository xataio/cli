VERSION ?= latest
POSTGRES_VERSION ?= 18
IMAGE_NAME = xata
REGISTRY ?= ghcr.io/xata
PUSH ?= false
GITHUB_TOKEN ?= $(shell echo $$GITHUB_TOKEN)
FULL_IMAGE_NAME = $(IMAGE_NAME)

ifdef REGISTRY
	FULL_IMAGE_NAME = $(REGISTRY)/$(IMAGE_NAME)
endif

TAG = $(FULL_IMAGE_NAME):$(VERSION)-pg$(POSTGRES_VERSION)

.PHONY: help build test push clean all

help: ## Show this help message
	@echo "Makefile for building Xata CLI Docker image"
	@echo ""
	@echo "Usage:"
	@echo "  make [target] [options]"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Options:"
	@echo "  VERSION=<version>            Version of Xata CLI to build (default: latest)"
	@echo "  POSTGRES_VERSION=<version>   PostgreSQL version to use (default: 17)"
	@echo "  REGISTRY=<registry>          Registry to push to (e.g., ghcr.io)"
	@echo "  PUSH=true                    Push image to registry after build"
	@echo "  GITHUB_TOKEN=<token>         GitHub token for pushing to ghcr.io"

build:
	@echo "Building Xata CLI Docker image"
	@echo "Version: $(VERSION)"
	@echo "PostgreSQL Version: $(POSTGRES_VERSION)"
	@echo "Image: $(TAG)"
	@if [ "$(VERSION)" = "latest" ]; then \
		docker build --build-arg POSTGRES_VERSION=$(POSTGRES_VERSION) -t $(TAG) -t $(FULL_IMAGE_NAME):latest-pg$(POSTGRES_VERSION) docker; \
	else \
		docker build --build-arg XATA_VERSION=$(VERSION) --build-arg POSTGRES_VERSION=$(POSTGRES_VERSION) -t $(TAG) docker; \
	fi
	@echo "Docker image built successfully: $(TAG)"

test:
	@echo "Testing Docker image..."
	@docker run --rm $(TAG) --version
	@echo "Docker image test passed"

push:
	@if [ -z "$(REGISTRY)" ]; then \
		echo "REGISTRY is not set. Use: make push REGISTRY=ghcr.io/xata"; \
		exit 1; \
	fi
	@if [ "$(REGISTRY)" = "ghcr.io/xata" ] && [ -z "$(GITHUB_TOKEN)" ]; then \
		echo "GITHUB_TOKEN is required for pushing to ghcr.io"; \
		echo "Set GITHUB_TOKEN environment variable or use: make push GITHUB_TOKEN=your_token"; \
		exit 1; \
	fi
	@if [ "$(REGISTRY)" = "ghcr.io/xata" ]; then \
		echo "Logging in to GitHub Container Registry..."; \
		echo "$(GITHUB_TOKEN)" | docker login ghcr.io -u USERNAME --password-stdin; \
	fi
	@echo "Pushing image to registry: $(REGISTRY)"
	@docker push $(TAG)
	@if [ "$(VERSION)" = "latest" ]; then \
		docker push $(FULL_IMAGE_NAME):latest-pg$(POSTGRES_VERSION); \
	fi
	@echo "Image pushed successfully"

clean:
	@echo "Removing local Docker images..."
	@docker rmi $(TAG) 2>/dev/null || true
	@if [ "$(VERSION)" = "latest" ]; then \
		docker rmi $(FULL_IMAGE_NAME):latest-pg$(POSTGRES_VERSION) 2>/dev/null || true; \
	fi
	@echo "Cleanup complete"

run:
	@docker run --rm -it $(TAG)

all: build test
	@if [ "$(PUSH)" = "true" ]; then \
		$(MAKE) push; \
	fi
	@echo "Build complete!"
	@echo ""
	@echo "To run the Xata CLI:"
	@echo "  docker run --rm $(TAG) --help"
	@echo "  make run"

latest:
	@$(MAKE) build VERSION=latest

dev:
	@$(MAKE) build
	@$(MAKE) run

.DEFAULT_GOAL := help
