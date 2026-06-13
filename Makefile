.PHONY: setup dev demo typecheck lint test clean

setup:
	node scripts/setup.mjs

dev:
	pnpm turbo run dev

demo:
	node scripts/demo.mjs

typecheck:
	pnpm -w typecheck

lint:
	pnpm -w lint

test:
	pnpm --filter engine test

clean:
	pnpm turbo run clean
