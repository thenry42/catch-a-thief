.PHONY: help dev dev-build prod prod-build down logs clean prune

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  dev        docker compose up (portfolio mode)"
	@echo "  dev-build  rebuild images then start (portfolio mode)"
	@echo "  prod       full dataset mode (cousin's run)"
	@echo "  prod-build rebuild images then start (full dataset)"
	@echo "  down       docker compose down"
	@echo "  logs       tail logs from both services"
	@echo "  clean      stop + wipe volumes (confirms first!)"
	@echo "  prune      docker system prune (confirms first!)"

dev:
	docker compose up -d

dev-build:
	docker compose up --build -d

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up

prod-build:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	@echo "WARNING: This will delete all volumes (Analysis DB, etc.) and images will need a full rebuild (~1h)."
	@read -p "Are you sure? [y/N] " ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		docker compose down -v; \
	fi

prune:
	@echo "WARNING: This will delete all volumes (Analysis DB, etc.) and images will need a full rebuild (~1h)."
	@read -p "Are you sure? [y/N] " ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		docker system prune -a --volumes -f; \
	fi
