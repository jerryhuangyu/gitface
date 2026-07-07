VERSION = $(shell git cliff --unreleased --bump --context | jq -r '.[0].version')

.PHONY: w w-build link unlink build dev lint typecheck unit-test test bump release

w:
	@pnpm --dir web install
	@pnpm --dir web dev

w-build:
	@pnpm --dir web install
	@pnpm --dir web build

link:
	@npm link --global

unlink:
	@npm unlink -g

build:
	@pnpm run build

dev:
	@pnpm run dev

lint:
	@pnpm run lint

typecheck:
	@pnpm run typecheck

unit-test:
	@pnpm run test

test: lint typecheck unit-test

bump:
	@git-cliff --unreleased --bump --prepend CHANGELOG.md
	@pnpm version $(VERSION) --no-git-tag-version
	@git add CHANGELOG.md package.json
	@git commit -m "chore(release): bump version to $(VERSION)"
	@echo "✅ Version bumped to $(VERSION)"

release:
	@git tag -a $(VERSION) -m "Release $(VERSION)"
	@git push origin $(VERSION)
	@echo "✅ Tag created: $(VERSION), pushed to remote."
