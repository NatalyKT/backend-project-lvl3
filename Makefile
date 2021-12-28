install:
	npm install

start:
	node bin/page-loader.js

publish:
	npm publish --dry-run

lint:
	npx eslint . --fix

test:
	DEBUG=page-loader*,nock.common,axios npm test

test-coverage:
	npm test -- --coverage --coverageProvider=v8

.PHONY: test
