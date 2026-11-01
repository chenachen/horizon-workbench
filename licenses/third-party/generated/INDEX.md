# Locked third-party dependency inventory

Target: `aarch64-apple-darwin`. 197 installed npm packages; 336 Rust crates.

Installed npm dependency closure and target-filtered Cargo normal/build/root-dev graph. Conservative dependency inventory; not a symbol-level bundle census. Rust proc-macros/build dependencies are classified separately. Platform npm compiler bindings are build tools even when declared optional dependencies.

Every row links the archived upstream notices. `package.json` / Cargo manifests retain original author and license declarations. The full JSON records integrity/checksum, consumers, origins and SHA-256 for each notice. Optional packages absent on this platform are listed separately in JSON and are not shipped.

MPL-2.0 crates include their exact unmodified `.crate` source archive in `sources/`, verified against Cargo.lock. Extract with `tar -xzf <name-version.crate>`; individual package sources retain their original license.

## npm

| Package | Exact version | Use | Declared license | Original notices |
| --- | --- | --- | --- | --- |
| @codemirror/autocomplete | 6.20.4 | runtime | MIT | [LICENSE](npm/@codemirror__autocomplete-6.20.4/LICENSE) |
| @codemirror/commands | 6.11.1 | runtime | MIT | [LICENSE](npm/@codemirror__commands-6.11.1/LICENSE) |
| @codemirror/lang-css | 6.3.1 | runtime | MIT | [LICENSE](npm/@codemirror__lang-css-6.3.1/LICENSE) |
| @codemirror/lang-html | 6.4.12 | runtime | MIT | [LICENSE](npm/@codemirror__lang-html-6.4.12/LICENSE) |
| @codemirror/lang-javascript | 6.2.5 | runtime | MIT | [LICENSE](npm/@codemirror__lang-javascript-6.2.5/LICENSE) |
| @codemirror/lang-json | 6.0.2 | runtime | MIT | [LICENSE](npm/@codemirror__lang-json-6.0.2/LICENSE) |
| @codemirror/lang-markdown | 6.5.2 | runtime | MIT | [LICENSE](npm/@codemirror__lang-markdown-6.5.2/LICENSE) |
| @codemirror/lang-python | 6.2.1 | runtime | MIT | [LICENSE](npm/@codemirror__lang-python-6.2.1/LICENSE) |
| @codemirror/lang-rust | 6.0.2 | runtime | MIT | [LICENSE](npm/@codemirror__lang-rust-6.0.2/LICENSE) |
| @codemirror/lang-sql | 6.10.0 | runtime | MIT | [LICENSE](npm/@codemirror__lang-sql-6.10.0/LICENSE) |
| @codemirror/language | 6.13.1 | runtime | MIT | [LICENSE](npm/@codemirror__language-6.13.1/LICENSE) |
| @codemirror/lint | 6.9.7 | runtime | MIT | [LICENSE](npm/@codemirror__lint-6.9.7/LICENSE) |
| @codemirror/search | 6.7.2 | runtime | MIT | [LICENSE](npm/@codemirror__search-6.7.2/LICENSE) |
| @codemirror/state | 6.7.6 | runtime | MIT | [LICENSE](npm/@codemirror__state-6.7.6/LICENSE) |
| @codemirror/streamparser | 6.0.0 | runtime | MIT | [LICENSE](npm/@codemirror__streamparser-6.0.0/LICENSE) |
| @codemirror/view | 6.43.15 | runtime | MIT | [LICENSE](npm/@codemirror__view-6.43.15/LICENSE) |
| @esbuild/darwin-arm64 | 0.28.2 | build | MIT | [LICENSE.md](npm/@esbuild__darwin-arm64-0.28.2/wrapper-license/LICENSE.md) |
| @jridgewell/resolve-uri | 3.1.2 | development | MIT | [LICENSE](npm/@jridgewell__resolve-uri-3.1.2/LICENSE) |
| @jridgewell/sourcemap-codec | 1.6.0 | development | MIT | [LICENSE](npm/@jridgewell__sourcemap-codec-1.6.0/LICENSE) |
| @jridgewell/trace-mapping | 0.3.31 | development | MIT | [LICENSE](npm/@jridgewell__trace-mapping-0.3.31/LICENSE) |
| @lezer/common | 1.5.5 | runtime | MIT | [LICENSE](npm/@lezer__common-1.5.5/LICENSE) |
| @lezer/css | 1.3.9 | runtime | MIT | [LICENSE](npm/@lezer__css-1.3.9/LICENSE) |
| @lezer/highlight | 1.2.5 | runtime | MIT | [LICENSE](npm/@lezer__highlight-1.2.5/LICENSE) |
| @lezer/html | 1.3.13 | runtime | MIT | [LICENSE](npm/@lezer__html-1.3.13/LICENSE) |
| @lezer/javascript | 1.5.6 | runtime | MIT | [LICENSE](npm/@lezer__javascript-1.5.6/LICENSE) |
| @lezer/json | 1.0.3 | runtime | MIT | [LICENSE](npm/@lezer__json-1.0.3/LICENSE) |
| @lezer/lr | 1.4.12 | runtime | MIT | [LICENSE](npm/@lezer__lr-1.4.12/LICENSE) |
| @lezer/markdown | 1.8.1 | runtime | MIT | [LICENSE](npm/@lezer__markdown-1.8.1/LICENSE) |
| @lezer/python | 1.1.19 | runtime | MIT | [LICENSE](npm/@lezer__python-1.1.19/LICENSE) |
| @lezer/rust | 1.0.3 | runtime | MIT | [LICENSE](npm/@lezer__rust-1.0.3/LICENSE) |
| @marijn/find-cluster-break | 1.0.4 | runtime | MIT | [LICENSE](npm/@marijn__find-cluster-break-1.0.4/LICENSE) |
| @oxc-project/types | 0.156.0 | development | MIT | [LICENSE](npm/@oxc-project__types-0.156.0/LICENSE) |
| @rolldown/binding-darwin-arm64 | 1.2.16 | build | MIT | [LICENSE](npm/@rolldown__binding-darwin-arm64-1.2.16/wrapper-license/LICENSE) · [THIRD-PARTY-LICENSE](npm/@rolldown__binding-darwin-arm64-1.2.16/wrapper-license/THIRD-PARTY-LICENSE) |
| @rolldown/pluginutils | 1.0.1 | development | MIT | [LICENSE](npm/@rolldown__pluginutils-1.0.1/LICENSE) |
| @rolldown/pluginutils | 1.0.1 | development | MIT | [LICENSE](npm/@rolldown__pluginutils-1.0.1/LICENSE) |
| @rollup/rollup-darwin-arm64 | 4.66.0 | build | MIT | [LICENSE.md](npm/@rollup__rollup-darwin-arm64-4.66.0/wrapper-license/LICENSE.md) |
| @standard-schema/spec | 1.1.0 | runtime | MIT | [LICENSE](npm/@standard-schema__spec-1.1.0/LICENSE) |
| @tauri-apps/api | 2.12.4 | runtime | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](npm/@tauri-apps__api-2.12.4/LICENSE-APACHE-2.0) · [LICENSE-MIT](npm/@tauri-apps__api-2.12.4/LICENSE-MIT) · [LICENSE.spdx](npm/@tauri-apps__api-2.12.4/LICENSE.spdx) |
| @tauri-apps/cli-darwin-arm64 | 2.12.4 | build | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](npm/@tauri-apps__cli-darwin-arm64-2.12.4/wrapper-license/LICENSE-APACHE-2.0) · [LICENSE-MIT](npm/@tauri-apps__cli-darwin-arm64-2.12.4/wrapper-license/LICENSE-MIT) |
| @tauri-apps/cli | 2.12.4 | development | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](npm/@tauri-apps__cli-2.12.4/LICENSE-APACHE-2.0) · [LICENSE-MIT](npm/@tauri-apps__cli-2.12.4/LICENSE-MIT) |
| @types/chai | 5.2.3 | development | MIT | [LICENSE](npm/@types__chai-5.2.3/LICENSE) |
| @types/debug | 4.1.13 | runtime | MIT | [LICENSE](npm/@types__debug-4.1.13/LICENSE) |
| @types/deep-eql | 4.0.2 | development | MIT | [LICENSE](npm/@types__deep-eql-4.0.2/LICENSE) |
| @types/estree-jsx | 1.0.5 | runtime | MIT | [LICENSE](npm/@types__estree-jsx-1.0.5/LICENSE) |
| @types/estree | 1.0.10 | development, runtime | MIT | [LICENSE](npm/@types__estree-1.0.10/LICENSE) |
| @types/estree | 1.0.9 | development | MIT | [LICENSE](npm/@types__estree-1.0.9/LICENSE) |
| @types/hast | 3.0.5 | runtime | MIT | [LICENSE](npm/@types__hast-3.0.5/LICENSE) |
| @types/mdast | 4.0.4 | runtime | MIT | [LICENSE](npm/@types__mdast-4.0.4/LICENSE) |
| @types/ms | 2.1.0 | runtime | MIT | [LICENSE](npm/@types__ms-2.1.0/LICENSE) |
| @types/node | 24.19.2 | development | MIT | [LICENSE](npm/@types__node-24.19.2/LICENSE) |
| @types/react-dom | 19.3.0 | development | MIT | [LICENSE](npm/@types__react-dom-19.3.0/LICENSE) |
| @types/react | 19.3.0 | development, runtime | MIT | [LICENSE](npm/@types__react-19.3.0/LICENSE) |
| @types/unist | 2.0.11 | runtime | MIT | [LICENSE](npm/@types__unist-2.0.11/LICENSE) |
| @types/unist | 3.0.3 | runtime | MIT | [LICENSE](npm/@types__unist-3.0.3/LICENSE) |
| @ungap/structured-clone | 1.4.0 | runtime | ISC | [LICENSE](npm/@ungap__structured-clone-1.4.0/LICENSE) |
| @vitejs/plugin-react | 6.1.2 | development | MIT | [LICENSE](npm/@vitejs__plugin-react-6.1.2/LICENSE) |
| @vitest/mocker | 5.0.5 | development | MIT | [LICENSE](npm/@vitest__mocker-5.0.5/LICENSE) |
| @vitest/spy | 5.0.5 | development | MIT | [LICENSE](npm/@vitest__spy-5.0.5/LICENSE) |
| @xterm/addon-fit | 0.11.0 | runtime | MIT | [LICENSE](npm/@xterm__addon-fit-0.11.0/LICENSE) |
| @xterm/xterm | 6.0.0 | runtime | MIT | [LICENSE](npm/@xterm__xterm-6.0.0/LICENSE) |
| assertion-error | 2.0.1 | development | MIT | [LICENSE](npm/assertion-error-2.0.1/LICENSE) |
| bail | 2.0.2 | runtime | MIT | [license](npm/bail-2.0.2/license) |
| ccount | 2.0.1 | runtime | MIT | [license](npm/ccount-2.0.1/license) |
| chai | 6.3.0 | development | MIT | [LICENSE](npm/chai-6.3.0/LICENSE) |
| character-entities-html4 | 2.1.0 | runtime | MIT | [license](npm/character-entities-html4-2.1.0/license) |
| character-entities-legacy | 3.0.0 | runtime | MIT | [license](npm/character-entities-legacy-3.0.0/license) |
| character-entities | 2.0.2 | runtime | MIT | [license](npm/character-entities-2.0.2/license) |
| character-reference-invalid | 2.0.1 | runtime | MIT | [license](npm/character-reference-invalid-2.0.1/license) |
| comma-separated-tokens | 2.0.3 | runtime | MIT | [license](npm/comma-separated-tokens-2.0.3/license) |
| cordis | 4.0.0-rc.12 | runtime | MIT | [LICENSE](npm/cordis-4.0.0-rc.12/upstream/cordis-4.0.0-rc.12/LICENSE) |
| cosmokit | 1.8.1 | runtime | MIT | [LICENSE](npm/cosmokit-1.8.1/LICENSE) |
| crelt | 1.0.7 | runtime | MIT | [LICENSE](npm/crelt-1.0.7/LICENSE) |
| csstype | 3.2.3 | development, runtime | MIT | [LICENSE](npm/csstype-3.2.3/LICENSE) |
| debug | 4.4.3 | runtime | MIT | [LICENSE](npm/debug-4.4.3/LICENSE) |
| decode-named-character-reference | 1.3.0 | runtime | MIT | [license](npm/decode-named-character-reference-1.3.0/license) |
| dequal | 2.0.3 | runtime | MIT | [license](npm/dequal-2.0.3/license) |
| detect-libc | 2.1.2 | development | Apache-2.0 | [LICENSE](npm/detect-libc-2.1.2/LICENSE) |
| devlop | 1.1.0 | runtime | MIT | [license](npm/devlop-1.1.0/license) |
| es-module-lexer | 2.3.2 | development | MIT | [LICENSE](npm/es-module-lexer-2.3.2/LICENSE) |
| esbuild | 0.28.2 | development | MIT | [LICENSE.md](npm/esbuild-0.28.2/LICENSE.md) |
| escape-string-regexp | 5.0.0 | runtime | MIT | [license](npm/escape-string-regexp-5.0.0/license) |
| estree-util-is-identifier-name | 3.0.0 | runtime | MIT | [license](npm/estree-util-is-identifier-name-3.0.0/license) |
| estree-walker | 3.0.3 | development | MIT | [LICENSE](npm/estree-walker-3.0.3/LICENSE) |
| expect-type | 1.4.0 | development | Apache-2.0 | [LICENSE](npm/expect-type-1.4.0/LICENSE) |
| extend | 3.0.2 | runtime | MIT | [LICENSE](npm/extend-3.0.2/LICENSE) |
| fdir | 6.5.0 | development | MIT | [LICENSE](npm/fdir-6.5.0/LICENSE) |
| fsevents | 2.3.2 | development | MIT | [LICENSE](npm/fsevents-2.3.2/LICENSE) |
| fsevents | 2.3.3 | development | MIT | [LICENSE](npm/fsevents-2.3.3/LICENSE) |
| fsevents | 2.3.3 | development | MIT | [LICENSE](npm/fsevents-2.3.3/LICENSE) |
| hast-util-to-jsx-runtime | 2.3.7 | runtime | MIT | [license](npm/hast-util-to-jsx-runtime-2.3.7/license) |
| hast-util-whitespace | 3.0.0 | runtime | MIT | [license](npm/hast-util-whitespace-3.0.0/license) |
| html-url-attributes | 3.0.1 | runtime | MIT | [license](npm/html-url-attributes-3.0.1/license) |
| inline-style-parser | 0.2.9 | runtime | MIT | [LICENSE](npm/inline-style-parser-0.2.9/LICENSE) |
| is-alphabetical | 2.0.1 | runtime | MIT | [license](npm/is-alphabetical-2.0.1/license) |
| is-alphanumerical | 2.0.1 | runtime | MIT | [license](npm/is-alphanumerical-2.0.1/license) |
| is-decimal | 2.0.1 | runtime | MIT | [license](npm/is-decimal-2.0.1/license) |
| is-hexadecimal | 2.0.1 | runtime | MIT | [license](npm/is-hexadecimal-2.0.1/license) |
| is-plain-obj | 4.1.0 | runtime | MIT | [license](npm/is-plain-obj-4.1.0/license) |
| lightningcss-darwin-arm64 | 1.33.0 | development | MPL-2.0 | [LICENSE](npm/lightningcss-darwin-arm64-1.33.0/LICENSE) |
| lightningcss | 1.33.0 | development | MPL-2.0 | [LICENSE](npm/lightningcss-1.33.0/LICENSE) |
| longest-streak | 3.1.0 | runtime | MIT | [license](npm/longest-streak-3.1.0/license) |
| lucide-react | 0.468.0 | runtime | ISC | [LICENSE](npm/lucide-react-0.468.0/LICENSE) · [copyright.js.map](npm/lucide-react-0.468.0/dist/esm/icons/copyright.js.map) |
| lucide | 0.468.0 | development | ISC | [LICENSE](npm/lucide-0.468.0/LICENSE) · [copyright.js.map](npm/lucide-0.468.0/dist/esm/icons/copyright.js.map) |
| magic-string | 1.4.5 | development | MIT | [LICENSE](npm/magic-string-1.4.5/LICENSE) |
| markdown-table | 3.0.4 | runtime | MIT | [license](npm/markdown-table-3.0.4/license) |
| mdast-util-find-and-replace | 3.0.4 | runtime | MIT | [license](npm/mdast-util-find-and-replace-3.0.4/license) |
| mdast-util-from-markdown | 2.1.0 | runtime | MIT | [license](npm/mdast-util-from-markdown-2.1.0/license) |
| mdast-util-gfm-autolink-literal | 2.0.1 | runtime | MIT | [license](npm/mdast-util-gfm-autolink-literal-2.0.1/license) |
| mdast-util-gfm-footnote | 2.1.0 | runtime | MIT | [license](npm/mdast-util-gfm-footnote-2.1.0/license) |
| mdast-util-gfm-strikethrough | 2.0.1 | runtime | MIT | [license](npm/mdast-util-gfm-strikethrough-2.0.1/license) |
| mdast-util-gfm-table | 2.0.0 | runtime | MIT | [license](npm/mdast-util-gfm-table-2.0.0/license) |
| mdast-util-gfm-task-list-item | 2.0.0 | runtime | MIT | [license](npm/mdast-util-gfm-task-list-item-2.0.0/license) |
| mdast-util-gfm | 3.1.0 | runtime | MIT | [license](npm/mdast-util-gfm-3.1.0/license) |
| mdast-util-mdx-expression | 2.0.1 | runtime | MIT | [license](npm/mdast-util-mdx-expression-2.0.1/license) |
| mdast-util-mdx-jsx | 3.2.0 | runtime | MIT | [license](npm/mdast-util-mdx-jsx-3.2.0/license) |
| mdast-util-mdxjs-esm | 2.0.1 | runtime | MIT | [license](npm/mdast-util-mdxjs-esm-2.0.1/license) |
| mdast-util-phrasing | 4.1.0 | runtime | MIT | [license](npm/mdast-util-phrasing-4.1.0/license) |
| mdast-util-to-hast | 13.2.1 | runtime | MIT | [license](npm/mdast-util-to-hast-13.2.1/license) |
| mdast-util-to-markdown | 2.2.1 | runtime | MIT | [license](npm/mdast-util-to-markdown-2.2.1/license) |
| mdast-util-to-string | 4.0.0 | runtime | MIT | [license](npm/mdast-util-to-string-4.0.0/license) |
| micromark-core-commonmark | 2.0.4 | runtime | MIT | [license](npm/micromark-core-commonmark-2.0.4/license) |
| micromark-extension-gfm-autolink-literal | 2.1.0 | runtime | MIT | [license](npm/micromark-extension-gfm-autolink-literal-2.1.0/license) |
| micromark-extension-gfm-footnote | 2.1.0 | runtime | MIT | [license](npm/micromark-extension-gfm-footnote-2.1.0/license) |
| micromark-extension-gfm-strikethrough | 2.1.0 | runtime | MIT | [license](npm/micromark-extension-gfm-strikethrough-2.1.0/license) |
| micromark-extension-gfm-table | 2.1.2 | runtime | MIT | [license](npm/micromark-extension-gfm-table-2.1.2/license) |
| micromark-extension-gfm-tagfilter | 2.0.0 | runtime | MIT | [license](npm/micromark-extension-gfm-tagfilter-2.0.0/license) |
| micromark-extension-gfm-task-list-item | 2.1.0 | runtime | MIT | [license](npm/micromark-extension-gfm-task-list-item-2.1.0/license) |
| micromark-extension-gfm | 3.0.0 | runtime | MIT | [license](npm/micromark-extension-gfm-3.0.0/license) |
| micromark-factory-destination | 2.0.1 | runtime | MIT | [license](npm/micromark-factory-destination-2.0.1/license) |
| micromark-factory-label | 2.0.1 | runtime | MIT | [license](npm/micromark-factory-label-2.0.1/license) |
| micromark-factory-space | 2.1.0 | runtime | MIT | [license](npm/micromark-factory-space-2.1.0/license) |
| micromark-factory-title | 2.0.1 | runtime | MIT | [license](npm/micromark-factory-title-2.0.1/license) |
| micromark-factory-whitespace | 2.0.1 | runtime | MIT | [license](npm/micromark-factory-whitespace-2.0.1/license) |
| micromark-util-character | 2.1.1 | runtime | MIT | [license](npm/micromark-util-character-2.1.1/license) |
| micromark-util-chunked | 2.0.1 | runtime | MIT | [license](npm/micromark-util-chunked-2.0.1/license) |
| micromark-util-classify-character | 2.0.1 | runtime | MIT | [license](npm/micromark-util-classify-character-2.0.1/license) |
| micromark-util-combine-extensions | 2.0.1 | runtime | MIT | [license](npm/micromark-util-combine-extensions-2.0.1/license) |
| micromark-util-decode-numeric-character-reference | 2.0.2 | runtime | MIT | [license](npm/micromark-util-decode-numeric-character-reference-2.0.2/license) |
| micromark-util-decode-string | 2.0.1 | runtime | MIT | [license](npm/micromark-util-decode-string-2.0.1/license) |
| micromark-util-edit-map | 1.0.0 | runtime | MIT | [license](npm/micromark-util-edit-map-1.0.0/license) |
| micromark-util-encode | 2.0.1 | runtime | MIT | [license](npm/micromark-util-encode-2.0.1/license) |
| micromark-util-html-tag-name | 2.0.1 | runtime | MIT | [license](npm/micromark-util-html-tag-name-2.0.1/license) |
| micromark-util-normalize-identifier | 2.0.1 | runtime | MIT | [license](npm/micromark-util-normalize-identifier-2.0.1/license) |
| micromark-util-resolve-all | 2.0.1 | runtime | MIT | [license](npm/micromark-util-resolve-all-2.0.1/license) |
| micromark-util-sanitize-uri | 2.0.1 | runtime | MIT | [license](npm/micromark-util-sanitize-uri-2.0.1/license) |
| micromark-util-subtokenize | 2.1.0 | runtime | MIT | [license](npm/micromark-util-subtokenize-2.1.0/license) |
| micromark-util-symbol | 2.0.1 | runtime | MIT | [license](npm/micromark-util-symbol-2.0.1/license) |
| micromark-util-types | 2.0.3 | runtime | MIT | [license](npm/micromark-util-types-2.0.3/license) |
| micromark | 4.0.3 | runtime | MIT | [license](npm/micromark-4.0.3/license) |
| ms | 2.1.3 | runtime | MIT | [license.md](npm/ms-2.1.3/license.md) |
| nanoid | 3.3.20 | development | MIT | [LICENSE](npm/nanoid-3.3.20/LICENSE) |
| obug | 3.0.0 | development | MIT | [LICENSE](npm/obug-3.0.0/LICENSE) |
| parse-entities | 4.0.2 | runtime | MIT | [license](npm/parse-entities-4.0.2/license) |
| picocolors | 1.1.1 | development | ISC | [LICENSE](npm/picocolors-1.1.1/LICENSE) |
| picomatch | 4.0.7 | development | MIT | [LICENSE](npm/picomatch-4.0.7/LICENSE) |
| playwright-core | 1.62.1 | development | Apache-2.0 | [LICENSE](npm/playwright-core-1.62.1/LICENSE) · [NOTICE](npm/playwright-core-1.62.1/NOTICE) · [ThirdPartyNotices.txt](npm/playwright-core-1.62.1/ThirdPartyNotices.txt) · [serverRegistry.js.LICENSE](npm/playwright-core-1.62.1/lib/serverRegistry.js.LICENSE) · [utilsBundle.js.LICENSE](npm/playwright-core-1.62.1/lib/utilsBundle.js.LICENSE) · [webp_codec.LICENSE](npm/playwright-core-1.62.1/lib/webp_codec.LICENSE) |
| playwright | 1.62.1 | development | Apache-2.0 | [LICENSE](npm/playwright-1.62.1/LICENSE) · [NOTICE](npm/playwright-1.62.1/NOTICE) · [ThirdPartyNotices.txt](npm/playwright-1.62.1/ThirdPartyNotices.txt) · [expect.js.LICENSE](npm/playwright-1.62.1/lib/matchers/expect.js.LICENSE) · [babelBundle.js.LICENSE](npm/playwright-1.62.1/lib/transform/babelBundle.js.LICENSE) · [esmLoader.js.LICENSE](npm/playwright-1.62.1/lib/transform/esmLoader.js.LICENSE) |
| postcss | 8.5.32 | development | MIT | [LICENSE](npm/postcss-8.5.32/LICENSE) |
| property-information | 7.2.0 | runtime | MIT | [license](npm/property-information-7.2.0/license) |
| react-dom | 19.3.1 | runtime | MIT | [LICENSE](npm/react-dom-19.3.1/LICENSE) |
| react-markdown | 10.1.0 | runtime | MIT | [license](npm/react-markdown-10.1.0/license) |
| react | 19.3.1 | runtime | MIT | [LICENSE](npm/react-19.3.1/LICENSE) |
| remark-gfm | 4.0.1 | runtime | MIT | [license](npm/remark-gfm-4.0.1/license) |
| remark-parse | 11.0.0 | runtime | MIT | [license](npm/remark-parse-11.0.0/license) |
| remark-rehype | 11.1.2 | runtime | MIT | [license](npm/remark-rehype-11.1.2/license) |
| remark-stringify | 11.0.0 | runtime | MIT | [license](npm/remark-stringify-11.0.0/license) |
| rolldown | 1.2.16 | development | MIT | [LICENSE](npm/rolldown-1.2.16/LICENSE) · [THIRD-PARTY-LICENSE](npm/rolldown-1.2.16/THIRD-PARTY-LICENSE) |
| rollup | 4.66.0 | development | MIT | [LICENSE.md](npm/rollup-4.66.0/LICENSE.md) |
| scheduler | 0.28.0 | runtime | MIT | [LICENSE](npm/scheduler-0.28.0/LICENSE) |
| source-map-js | 1.2.2 | development | BSD-3-Clause | [LICENSE](npm/source-map-js-1.2.2/LICENSE) |
| space-separated-tokens | 2.0.2 | runtime | MIT | [license](npm/space-separated-tokens-2.0.2/license) |
| std-env | 4.3.0 | development | MIT | [LICENCE](npm/std-env-4.3.0/LICENCE) |
| stringify-entities | 4.0.4 | runtime | MIT | [license](npm/stringify-entities-4.0.4/license) |
| style-mod | 4.1.4 | runtime | MIT | [LICENSE](npm/style-mod-4.1.4/LICENSE) |
| style-to-object | 2.0.2 | runtime | MIT | [LICENSE](npm/style-to-object-2.0.2/LICENSE) |
| tinybench | 6.2.2 | development | MIT | [LICENSE](npm/tinybench-6.2.2/LICENSE) |
| tinyexec | 1.3.1 | development | MIT | [LICENSE](npm/tinyexec-1.3.1/LICENSE) |
| tinyglobby | 0.2.17 | development | MIT | [LICENSE](npm/tinyglobby-0.2.17/LICENSE) |
| trim-lines | 3.0.1 | runtime | MIT | [license](npm/trim-lines-3.0.1/license) |
| trough | 2.2.0 | runtime | MIT | [license](npm/trough-2.2.0/license) |
| tsx | 4.23.15 | development | MIT | [LICENSE](npm/tsx-4.23.15/LICENSE) |
| typescript | 5.9.3 | development | Apache-2.0 | [LICENSE.txt](npm/typescript-5.9.3/LICENSE.txt) · [ThirdPartyNoticeText.txt](npm/typescript-5.9.3/ThirdPartyNoticeText.txt) |
| undici-types | 7.24.6 | development | MIT | [LICENSE](npm/undici-types-7.24.6/LICENSE) |
| unified | 11.0.5 | runtime | MIT | [license](npm/unified-11.0.5/license) |
| unist-util-is | 6.0.1 | runtime | MIT | [license](npm/unist-util-is-6.0.1/license) |
| unist-util-position | 5.0.0 | runtime | MIT | [license](npm/unist-util-position-5.0.0/license) |
| unist-util-stringify-position | 4.0.0 | runtime | MIT | [license](npm/unist-util-stringify-position-4.0.0/license) |
| unist-util-visit-parents | 6.1.0 | runtime | MIT | [license](npm/unist-util-visit-parents-6.1.0/license) |
| unist-util-visit | 5.2.0 | runtime | MIT | [license](npm/unist-util-visit-5.2.0/license) |
| vfile-message | 4.0.3 | runtime | MIT | [license](npm/vfile-message-4.0.3/license) |
| vfile | 6.0.3 | runtime | MIT | [license](npm/vfile-6.0.3/license) |
| vite | 7.3.7 | development | MIT | [LICENSE.md](npm/vite-7.3.7/LICENSE.md) |
| vite | 8.3.5 | development | MIT | [LICENSE.md](npm/vite-8.3.5/LICENSE.md) |
| vitest | 5.0.5 | development | MIT | [LICENSE.md](npm/vitest-5.0.5/LICENSE.md) |
| w3c-keyname | 2.2.8 | runtime | MIT | [LICENSE](npm/w3c-keyname-2.2.8/LICENSE) |
| why-is-node-running | 3.2.1 | development | MIT | [LICENSE](npm/why-is-node-running-3.2.1/LICENSE) |
| zwitch | 2.0.4 | runtime | MIT | [license](npm/zwitch-2.0.4/license) |

## cargo

| Package | Exact version | Use | Declared license | Original notices |
| --- | --- | --- | --- | --- |
| adler2 | 2.0.1 | build, development, runtime | 0BSD OR MIT OR Apache-2.0 | [LICENSE-0BSD](cargo/adler2-2.0.1/LICENSE-0BSD) · [LICENSE-APACHE](cargo/adler2-2.0.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/adler2-2.0.1/LICENSE-MIT) |
| aho-corasick | 1.1.5 | build, development, runtime | Unlicense OR MIT | [COPYING](cargo/aho-corasick-1.1.5/COPYING) · [LICENSE-MIT](cargo/aho-corasick-1.1.5/LICENSE-MIT) · [UNLICENSE](cargo/aho-corasick-1.1.5/UNLICENSE) |
| alloc-no-stdlib | 3.0.0 | build, development, runtime | BSD-3-Clause | [LICENSE](cargo/alloc-no-stdlib-3.0.0/LICENSE) |
| alloc-stdlib | 0.3.0 | build, development, runtime | BSD-3-Clause | [LICENSE](cargo/alloc-stdlib-0.3.0/upstream/alloc-stdlib-0.3.0/LICENSE) |
| allocator-api2 | 0.2.21 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/allocator-api2-0.2.21/LICENSE-APACHE) · [LICENSE-MIT](cargo/allocator-api2-0.2.21/LICENSE-MIT) |
| anyhow | 1.0.104 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/anyhow-1.0.104/LICENSE-APACHE) · [LICENSE-MIT](cargo/anyhow-1.0.104/LICENSE-MIT) |
| atomic-waker | 1.1.2 | runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/atomic-waker-1.1.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/atomic-waker-1.1.2/LICENSE-MIT) · [LICENSE-THIRD-PARTY](cargo/atomic-waker-1.1.2/LICENSE-THIRD-PARTY) |
| autocfg | 1.5.1 | build, development | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/autocfg-1.5.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/autocfg-1.5.1/LICENSE-MIT) |
| base64 | 0.21.7 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/base64-0.21.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/base64-0.21.7/LICENSE-MIT) |
| base64 | 0.22.1 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/base64-0.22.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/base64-0.22.1/LICENSE-MIT) |
| base64 | 0.23.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/base64-0.23.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/base64-0.23.1/LICENSE-MIT) |
| bit-set | 0.8.0 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/bit-set-0.8.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/bit-set-0.8.0/LICENSE-MIT) |
| bit-vec | 0.8.0 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/bit-vec-0.8.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/bit-vec-0.8.0/LICENSE-MIT) |
| bitflags | 1.3.2 | build, development, runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/bitflags-1.3.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/bitflags-1.3.2/LICENSE-MIT) |
| bitflags | 2.13.2 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/bitflags-2.13.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/bitflags-2.13.2/LICENSE-MIT) |
| block-buffer | 0.10.4 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/block-buffer-0.10.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/block-buffer-0.10.4/LICENSE-MIT) |
| block2 | 0.6.2 | build, development, runtime | MIT | [LICENSE.md](cargo/block2-0.6.2/upstream/objc2-b4167b582b2f75f9a1be75495c41b765344fd03c/LICENSE.md) · [MIT.txt](cargo/block2-0.6.2/upstream/spdx/MIT.txt) |
| brotli-decompressor | 6.2.0 | build, development, runtime | BSD-3-Clause/MIT | [LICENSE](cargo/brotli-decompressor-6.2.0/LICENSE) |
| brotli | 9.1.1 | build, development, runtime | BSD-3-Clause AND MIT | [LICENSE.BSD-3-Clause](cargo/brotli-9.1.1/LICENSE.BSD-3-Clause) · [LICENSE.MIT](cargo/brotli-9.1.1/LICENSE.MIT) |
| bs58 | 0.5.1 | build, development, runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/bs58-0.5.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/bs58-0.5.1/LICENSE-MIT) |
| bstr | 1.13.1 | runtime | MIT OR Apache-2.0 | [COPYING](cargo/bstr-1.13.1/COPYING) · [LICENSE-APACHE](cargo/bstr-1.13.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/bstr-1.13.1/LICENSE-MIT) |
| bumpalo | 3.20.3 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/bumpalo-3.20.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/bumpalo-3.20.3/LICENSE-MIT) |
| bytemuck | 1.25.2 | runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/bytemuck-1.25.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/bytemuck-1.25.2/LICENSE-MIT) · [LICENSE-ZLIB](cargo/bytemuck-1.25.2/LICENSE-ZLIB) |
| byteorder-lite | 0.1.0 | runtime | Unlicense OR MIT | [LICENSE-MIT](cargo/byteorder-lite-0.1.0/LICENSE-MIT) · [UNLICENSE](cargo/byteorder-lite-0.1.0/UNLICENSE) |
| byteorder | 1.5.0 | build, development | Unlicense OR MIT | [COPYING](cargo/byteorder-1.5.0/COPYING) · [LICENSE-MIT](cargo/byteorder-1.5.0/LICENSE-MIT) · [UNLICENSE](cargo/byteorder-1.5.0/UNLICENSE) |
| bytes | 1.12.1 | build, development, runtime | MIT | [LICENSE](cargo/bytes-1.12.1/LICENSE) |
| camino | 1.2.6 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/camino-1.2.6/LICENSE-APACHE) · [LICENSE-MIT](cargo/camino-1.2.6/LICENSE-MIT) |
| cargo-platform | 0.1.9 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/cargo-platform-0.1.9/LICENSE-APACHE) · [LICENSE-MIT](cargo/cargo-platform-0.1.9/LICENSE-MIT) |
| cargo_metadata | 0.19.2 | build, development, runtime | MIT | [LICENSE-MIT](cargo/cargo_metadata-0.19.2/LICENSE-MIT) |
| cargo_toml | 1.0.1 | build, development | Apache-2.0 OR MIT | [LICENSE](cargo/cargo_toml-1.0.1/LICENSE) |
| cc | 1.10.0 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/cc-1.10.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/cc-1.10.0/LICENSE-MIT) |
| cfb | 0.14.0 | build, development, runtime | MIT | [LICENSE](cargo/cfb-0.14.0/LICENSE) |
| cfg-if | 1.0.5 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/cfg-if-1.0.5/LICENSE-APACHE) · [LICENSE-MIT](cargo/cfg-if-1.0.5/LICENSE-MIT) |
| cfg_aliases | 0.1.1 | build | MIT | [LICENSE](cargo/cfg_aliases-0.1.1/LICENSE) · [NOTICES.md](cargo/cfg_aliases-0.1.1/NOTICES.md) |
| cfg_aliases | 0.2.2 | build | MIT | [LICENSE](cargo/cfg_aliases-0.2.2/LICENSE) · [NOTICES.md](cargo/cfg_aliases-0.2.2/NOTICES.md) |
| chacha20 | 0.10.2 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/chacha20-0.10.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/chacha20-0.10.2/LICENSE-MIT) |
| chrono | 0.4.45 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE.txt](cargo/chrono-0.4.45/LICENSE.txt) |
| cookie | 0.18.2 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/cookie-0.18.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/cookie-0.18.2/LICENSE-MIT) |
| core-foundation-sys | 0.8.7 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/core-foundation-sys-0.8.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/core-foundation-sys-0.8.7/LICENSE-MIT) |
| core-foundation | 0.10.1 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/core-foundation-0.10.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/core-foundation-0.10.1/LICENSE-MIT) |
| core-graphics-types | 0.2.0 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/core-graphics-types-0.2.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/core-graphics-types-0.2.0/LICENSE-MIT) |
| core-graphics | 0.25.0 | development, runtime | MIT OR Apache-2.0 | [COPYRIGHT](cargo/core-graphics-0.25.0/COPYRIGHT) · [LICENSE-APACHE](cargo/core-graphics-0.25.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/core-graphics-0.25.0/LICENSE-MIT) |
| cpufeatures | 0.2.17 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/cpufeatures-0.2.17/LICENSE-APACHE) · [LICENSE-MIT](cargo/cpufeatures-0.2.17/LICENSE-MIT) |
| crc32fast | 1.5.3 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/crc32fast-1.5.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/crc32fast-1.5.3/LICENSE-MIT) |
| crossbeam-channel | 0.5.17 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/crossbeam-channel-0.5.17/LICENSE-APACHE) · [LICENSE-MIT](cargo/crossbeam-channel-0.5.17/LICENSE-MIT) · [LICENSE-THIRD-PARTY](cargo/crossbeam-channel-0.5.17/LICENSE-THIRD-PARTY) |
| crossbeam-deque | 0.8.8 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/crossbeam-deque-0.8.8/LICENSE-APACHE) · [LICENSE-MIT](cargo/crossbeam-deque-0.8.8/LICENSE-MIT) |
| crossbeam-epoch | 0.9.21 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/crossbeam-epoch-0.9.21/LICENSE-APACHE) · [LICENSE-MIT](cargo/crossbeam-epoch-0.9.21/LICENSE-MIT) |
| crossbeam-utils | 0.8.23 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/crossbeam-utils-0.8.23/LICENSE-APACHE) · [LICENSE-MIT](cargo/crossbeam-utils-0.8.23/LICENSE-MIT) |
| crypto-common | 0.1.7 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/crypto-common-0.1.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/crypto-common-0.1.7/LICENSE-MIT) |
| cssparser-macros | 0.7.1 | build, development | MPL-2.0 | [LICENSE](cargo/cssparser-macros-0.7.1/LICENSE) |
| cssparser | 0.37.0 | build, development, runtime | MPL-2.0 | [LICENSE](cargo/cssparser-0.37.0/LICENSE) |
| ctor | 1.0.13 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/ctor-1.0.13/LICENSE-APACHE) · [LICENSE-MIT](cargo/ctor-1.0.13/LICENSE-MIT) |
| darling | 0.24.1 | build, development | MIT | [LICENSE](cargo/darling-0.24.1/LICENSE) |
| darling_core | 0.24.1 | build, development | MIT | [LICENSE](cargo/darling_core-0.24.1/LICENSE) |
| darling_macro | 0.24.1 | build, development | MIT | [LICENSE](cargo/darling_macro-0.24.1/LICENSE) |
| defmt-macros | 1.2.0 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/defmt-macros-1.2.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/defmt-macros-1.2.0/LICENSE-MIT) |
| defmt-parser | 1.1.0 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/defmt-parser-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/defmt-parser-1.1.0/LICENSE-MIT) |
| defmt | 1.2.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/defmt-1.2.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/defmt-1.2.0/LICENSE-MIT) |
| deranged | 0.5.9 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-Apache](cargo/deranged-0.5.9/LICENSE-Apache) · [LICENSE-MIT](cargo/deranged-0.5.9/LICENSE-MIT) |
| derive_more-impl | 2.1.1 | build, development | MIT | [LICENSE](cargo/derive_more-impl-2.1.1/LICENSE) |
| derive_more | 2.1.1 | build, development, runtime | MIT | [LICENSE](cargo/derive_more-2.1.1/LICENSE) |
| digest | 0.10.7 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/digest-0.10.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/digest-0.10.7/LICENSE-MIT) |
| dirs-sys | 0.5.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/dirs-sys-0.5.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/dirs-sys-0.5.0/LICENSE-MIT) |
| dirs | 7.0.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/dirs-7.0.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/dirs-7.0.0/LICENSE-MIT) |
| dispatch2 | 0.3.1 | build, development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/dispatch2-0.3.1/upstream/objc2-8852b424193ca41602281b3d7540d7c8ed51e49a/LICENSE.md) · [MIT.txt](cargo/dispatch2-0.3.1/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/dispatch2-0.3.1/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/dispatch2-0.3.1/upstream/spdx/Zlib.txt) |
| displaydoc | 0.2.7 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/displaydoc-0.2.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/displaydoc-0.2.7/LICENSE-MIT) |
| dom_query | 0.28.0 | build, development, runtime | MIT | [LICENSE](cargo/dom_query-0.28.0/LICENSE) |
| downcast-rs | 1.2.1 | runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/downcast-rs-1.2.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/downcast-rs-1.2.1/LICENSE-MIT) |
| dpi | 0.1.2 | development, runtime | Apache-2.0 AND MIT | [LICENSE](cargo/dpi-0.1.2/LICENSE) · [LICENSE-LIBM-MIT](cargo/dpi-0.1.2/LICENSE-LIBM-MIT) |
| dtoa-short | 0.3.5 | build, development, runtime | MPL-2.0 | [LICENSE](cargo/dtoa-short-0.3.5/LICENSE) |
| dtoa | 1.0.11 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/dtoa-1.0.11/LICENSE-APACHE) · [LICENSE-MIT](cargo/dtoa-1.0.11/LICENSE-MIT) |
| dunce | 1.0.5 | build, development, runtime | CC0-1.0 OR MIT-0 OR Apache-2.0 | [LICENSE](cargo/dunce-1.0.5/LICENSE) |
| dyn-clone | 1.0.20 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/dyn-clone-1.0.20/LICENSE-APACHE) · [LICENSE-MIT](cargo/dyn-clone-1.0.20/LICENSE-MIT) |
| embed-resource | 3.0.12 | build, development | MIT | [LICENSE](cargo/embed-resource-3.0.12/LICENSE) |
| embed_plist | 1.2.2 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/embed_plist-1.2.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/embed_plist-1.2.2/LICENSE-MIT) |
| equivalent | 1.0.3 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/equivalent-1.0.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/equivalent-1.0.3/LICENSE-MIT) |
| erased-serde | 0.4.11 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/erased-serde-0.4.11/LICENSE-APACHE) · [LICENSE-MIT](cargo/erased-serde-0.4.11/LICENSE-MIT) |
| errno | 0.3.14 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/errno-0.3.14/LICENSE-APACHE) · [LICENSE-MIT](cargo/errno-0.3.14/LICENSE-MIT) |
| fastrand | 2.5.0 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/fastrand-2.5.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/fastrand-2.5.0/LICENSE-MIT) |
| fdeflate | 0.3.7 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/fdeflate-0.3.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/fdeflate-0.3.7/LICENSE-MIT) |
| filedescriptor | 0.8.3 | runtime | MIT | [LICENSE.md](cargo/filedescriptor-0.8.3/LICENSE.md) |
| find-msvc-tools | 0.1.15 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/find-msvc-tools-0.1.15/LICENSE-APACHE) · [LICENSE-MIT](cargo/find-msvc-tools-0.1.15/LICENSE-MIT) |
| flate2 | 1.1.10 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/flate2-1.1.10/LICENSE-APACHE) · [LICENSE-MIT](cargo/flate2-1.1.10/LICENSE-MIT) |
| fnv | 1.0.7 | build, development, runtime | Apache-2.0 / MIT | [LICENSE-APACHE](cargo/fnv-1.0.7/LICENSE-APACHE) · [LICENSE-MIT](cargo/fnv-1.0.7/LICENSE-MIT) |
| foldhash | 0.2.0 | build, development, runtime | Zlib | [LICENSE](cargo/foldhash-0.2.0/LICENSE) |
| foreign-types-macros | 0.2.4 | build, development | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/foreign-types-macros-0.2.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/foreign-types-macros-0.2.4/LICENSE-MIT) |
| foreign-types-shared | 0.3.1 | development, runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/foreign-types-shared-0.3.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/foreign-types-shared-0.3.1/LICENSE-MIT) |
| foreign-types | 0.5.0 | development, runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/foreign-types-0.5.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/foreign-types-0.5.0/LICENSE-MIT) |
| form_urlencoded | 1.2.2 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/form_urlencoded-1.2.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/form_urlencoded-1.2.2/LICENSE-MIT) |
| futures-channel | 0.3.34 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-channel-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-channel-0.3.34/LICENSE-MIT) |
| futures-core | 0.3.34 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-core-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-core-0.3.34/LICENSE-MIT) |
| futures-io | 0.3.34 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-io-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-io-0.3.34/LICENSE-MIT) |
| futures-macro | 0.3.34 | build | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-macro-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-macro-0.3.34/LICENSE-MIT) |
| futures-sink | 0.3.34 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-sink-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-sink-0.3.34/LICENSE-MIT) |
| futures-task | 0.3.34 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-task-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-task-0.3.34/LICENSE-MIT) |
| futures-util | 0.3.34 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/futures-util-0.3.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/futures-util-0.3.34/LICENSE-MIT) |
| generic-array | 0.14.7 | build, development, runtime | MIT | [LICENSE](cargo/generic-array-0.14.7/LICENSE) |
| getrandom | 0.2.17 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/getrandom-0.2.17/LICENSE-APACHE) · [LICENSE-MIT](cargo/getrandom-0.2.17/LICENSE-MIT) |
| getrandom | 0.3.4 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/getrandom-0.3.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/getrandom-0.3.4/LICENSE-MIT) |
| getrandom | 0.4.3 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/getrandom-0.4.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/getrandom-0.4.3/LICENSE-MIT) |
| glob | 0.3.4 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/glob-0.3.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/glob-0.3.4/LICENSE-MIT) |
| globset | 0.4.21 | runtime | Unlicense OR MIT | [COPYING](cargo/globset-0.4.21/COPYING) · [LICENSE-MIT](cargo/globset-0.4.21/LICENSE-MIT) · [UNLICENSE](cargo/globset-0.4.21/UNLICENSE) |
| hashbrown | 0.12.3 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/hashbrown-0.12.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/hashbrown-0.12.3/LICENSE-MIT) |
| hashbrown | 0.17.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/hashbrown-0.17.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/hashbrown-0.17.1/LICENSE-MIT) |
| heck | 0.5.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/heck-0.5.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/heck-0.5.0/LICENSE-MIT) |
| hex | 0.4.3 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/hex-0.4.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/hex-0.4.3/LICENSE-MIT) |
| html5ever | 0.39.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/html5ever-0.39.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/html5ever-0.39.0/LICENSE-MIT) |
| http-body-util | 0.1.5 | runtime | MIT | [LICENSE](cargo/http-body-util-0.1.5/LICENSE) |
| http-body | 1.1.0 | runtime | MIT | [LICENSE](cargo/http-body-1.1.0/LICENSE) |
| http | 1.5.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/http-1.5.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/http-1.5.0/LICENSE-MIT) |
| httparse | 1.10.1 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/httparse-1.10.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/httparse-1.10.1/LICENSE-MIT) |
| hyper-rustls | 0.27.10 | runtime | Apache-2.0 OR ISC OR MIT | [LICENSE-APACHE](cargo/hyper-rustls-0.27.10/LICENSE-APACHE) · [LICENSE-ISC](cargo/hyper-rustls-0.27.10/LICENSE-ISC) · [LICENSE-MIT](cargo/hyper-rustls-0.27.10/LICENSE-MIT) |
| hyper-util | 0.1.21 | runtime | MIT | [LICENSE](cargo/hyper-util-0.1.21/LICENSE) |
| hyper | 1.12.0 | runtime | MIT | [LICENSE](cargo/hyper-1.12.0/LICENSE) |
| iana-time-zone | 0.1.65 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/iana-time-zone-0.1.65/LICENSE-APACHE) · [LICENSE-MIT](cargo/iana-time-zone-0.1.65/LICENSE-MIT) |
| ico | 0.6.0 | build, development | MIT | [LICENSE](cargo/ico-0.6.0/LICENSE) |
| icu_collections | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_collections-2.4.0/LICENSE) |
| icu_locale_core | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_locale_core-2.4.0/LICENSE) |
| icu_normalizer | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_normalizer-2.4.0/LICENSE) |
| icu_normalizer_data | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_normalizer_data-2.4.0/LICENSE) |
| icu_properties | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_properties-2.4.0/LICENSE) |
| icu_properties_data | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_properties_data-2.4.0/LICENSE) |
| icu_provider | 2.4.0 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/icu_provider-2.4.0/LICENSE) |
| ident_case | 1.0.1 | build, development | MIT/Apache-2.0 | [LICENSE](cargo/ident_case-1.0.1/LICENSE) |
| idna | 1.1.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/idna-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/idna-1.1.0/LICENSE-MIT) |
| idna_adapter | 1.2.2 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/idna_adapter-1.2.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/idna_adapter-1.2.2/LICENSE-MIT) |
| ignore | 0.4.34 | runtime | Unlicense OR MIT | [COPYING](cargo/ignore-0.4.34/COPYING) · [LICENSE-MIT](cargo/ignore-0.4.34/LICENSE-MIT) · [UNLICENSE](cargo/ignore-0.4.34/UNLICENSE) |
| image-webp | 0.2.4 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/image-webp-0.2.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/image-webp-0.2.4/LICENSE-MIT) |
| image | 0.25.10 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/image-0.25.10/LICENSE-APACHE) · [LICENSE-MIT](cargo/image-0.25.10/LICENSE-MIT) |
| indexmap | 1.9.3 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/indexmap-1.9.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/indexmap-1.9.3/LICENSE-MIT) |
| indexmap | 2.14.2 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/indexmap-2.14.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/indexmap-2.14.2/LICENSE-MIT) |
| infer | 0.22.0 | build, development, runtime | MIT | [LICENSE](cargo/infer-0.22.0/LICENSE) |
| ipnet | 2.12.2 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/ipnet-2.12.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/ipnet-2.12.2/LICENSE-MIT) |
| itoa | 1.0.18 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/itoa-1.0.18/LICENSE-APACHE) · [LICENSE-MIT](cargo/itoa-1.0.18/LICENSE-MIT) |
| jiff-core | 0.1.1 | build, development, runtime | Unlicense OR MIT | [COPYING](cargo/jiff-core-0.1.1/COPYING) · [LICENSE-MIT](cargo/jiff-core-0.1.1/LICENSE-MIT) · [UNLICENSE](cargo/jiff-core-0.1.1/UNLICENSE) |
| jiff | 0.2.38 | build, development, runtime | Unlicense OR MIT | [COPYING](cargo/jiff-0.2.38/COPYING) · [LICENSE-MIT](cargo/jiff-0.2.38/LICENSE-MIT) · [UNLICENSE](cargo/jiff-0.2.38/UNLICENSE) |
| json-patch | 4.2.0 | build, development, runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/json-patch-4.2.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/json-patch-4.2.0/LICENSE-MIT) |
| jsonptr | 0.7.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/jsonptr-0.7.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/jsonptr-0.7.1/LICENSE-MIT) |
| keyboard-types | 0.8.3 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/keyboard-types-0.8.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/keyboard-types-0.8.3/LICENSE-MIT) |
| keyring | 3.6.3 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/keyring-3.6.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/keyring-3.6.3/LICENSE-MIT) |
| libc | 0.2.191 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/libc-0.2.191/LICENSE-APACHE) · [LICENSE-MIT](cargo/libc-0.2.191/LICENSE-MIT) |
| litemap | 0.8.3 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/litemap-0.8.3/LICENSE) |
| lock_api | 0.4.14 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/lock_api-0.4.14/LICENSE-APACHE) · [LICENSE-MIT](cargo/lock_api-0.4.14/LICENSE-MIT) |
| log | 0.4.34 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/log-0.4.34/LICENSE-APACHE) · [LICENSE-MIT](cargo/log-0.4.34/LICENSE-MIT) |
| lru-slab | 0.1.3 | runtime | MIT OR Apache-2.0 OR Zlib | [LICENSE-APACHE](cargo/lru-slab-0.1.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/lru-slab-0.1.3/LICENSE-MIT) · [LICENSE-ZLIB](cargo/lru-slab-0.1.3/LICENSE-ZLIB) |
| markup5ever | 0.39.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/markup5ever-0.39.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/markup5ever-0.39.0/LICENSE-MIT) |
| memchr | 2.8.3 | build, development, runtime | Unlicense OR MIT | [COPYING](cargo/memchr-2.8.3/COPYING) · [LICENSE-MIT](cargo/memchr-2.8.3/LICENSE-MIT) · [UNLICENSE](cargo/memchr-2.8.3/UNLICENSE) |
| mime | 0.3.17 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/mime-0.3.17/LICENSE-APACHE) · [LICENSE-MIT](cargo/mime-0.3.17/LICENSE-MIT) |
| miniz_oxide | 0.8.9 | build, development, runtime | MIT OR Zlib OR Apache-2.0 | [LICENSE](cargo/miniz_oxide-0.8.9/LICENSE) · [LICENSE-APACHE.md](cargo/miniz_oxide-0.8.9/LICENSE-APACHE.md) · [LICENSE-MIT.md](cargo/miniz_oxide-0.8.9/LICENSE-MIT.md) · [LICENSE-ZLIB.md](cargo/miniz_oxide-0.8.9/LICENSE-ZLIB.md) |
| miniz_oxide | 0.9.1 | build, development, runtime | MIT OR Zlib OR Apache-2.0 | [LICENSE](cargo/miniz_oxide-0.9.1/LICENSE) · [LICENSE-APACHE.md](cargo/miniz_oxide-0.9.1/LICENSE-APACHE.md) · [LICENSE-MIT.md](cargo/miniz_oxide-0.9.1/LICENSE-MIT.md) · [LICENSE-ZLIB.md](cargo/miniz_oxide-0.9.1/LICENSE-ZLIB.md) |
| mio | 1.2.4 | development, runtime | MIT | [LICENSE](cargo/mio-1.2.4/LICENSE) |
| moxcms | 0.8.1 | runtime | BSD-3-Clause OR Apache-2.0 | [LICENSE-APACHE.md](cargo/moxcms-0.8.1/LICENSE-APACHE.md) · [LICENSE.md](cargo/moxcms-0.8.1/LICENSE.md) |
| muda | 0.20.0 | development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/muda-0.20.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/muda-0.20.0/LICENSE-MIT) · [LICENSE.spdx](cargo/muda-0.20.0/LICENSE.spdx) |
| new_debug_unreachable | 1.0.6 | build, development, runtime | MIT | [LICENSE-MIT](cargo/new_debug_unreachable-1.0.6/LICENSE-MIT) |
| nix | 0.28.0 | runtime | MIT | [LICENSE](cargo/nix-0.28.0/LICENSE) |
| notify-types | 2.2.0 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/notify-types-2.2.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/notify-types-2.2.0/LICENSE-MIT) |
| notify | 8.2.1 | runtime | CC0-1.0 | [LICENSE-CC0](cargo/notify-8.2.1/LICENSE-CC0) |
| num-conv | 0.2.2 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-Apache](cargo/num-conv-0.2.2/LICENSE-Apache) · [LICENSE-MIT](cargo/num-conv-0.2.2/LICENSE-MIT) |
| num-traits | 0.2.19 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/num-traits-0.2.19/LICENSE-APACHE) · [LICENSE-MIT](cargo/num-traits-0.2.19/LICENSE-MIT) |
| objc2-app-kit | 0.3.2 | development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-app-kit-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-app-kit-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-app-kit-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-app-kit-0.3.2/upstream/spdx/Zlib.txt) |
| objc2-core-foundation | 0.3.2 | build, development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-core-foundation-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-core-foundation-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-core-foundation-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-core-foundation-0.3.2/upstream/spdx/Zlib.txt) |
| objc2-core-graphics | 0.3.2 | development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-core-graphics-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-core-graphics-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-core-graphics-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-core-graphics-0.3.2/upstream/spdx/Zlib.txt) |
| objc2-core-services | 0.3.2 | runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-core-services-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-core-services-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-core-services-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-core-services-0.3.2/upstream/spdx/Zlib.txt) |
| objc2-encode | 4.1.0 | build, development, runtime | MIT | [LICENSE.md](cargo/objc2-encode-4.1.0/upstream/objc2-8d214f5477365ffcbcbb7de058c86ed9a518efb7/LICENSE.md) · [MIT.txt](cargo/objc2-encode-4.1.0/upstream/spdx/MIT.txt) |
| objc2-exception-helper | 0.1.1 | build, development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-exception-helper-0.1.1/upstream/objc2-8d214f5477365ffcbcbb7de058c86ed9a518efb7/LICENSE.md) · [MIT.txt](cargo/objc2-exception-helper-0.1.1/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-exception-helper-0.1.1/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-exception-helper-0.1.1/upstream/spdx/Zlib.txt) |
| objc2-foundation | 0.3.2 | build, development, runtime | MIT | [LICENSE.md](cargo/objc2-foundation-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-foundation-0.3.2/upstream/spdx/MIT.txt) |
| objc2-io-surface | 0.3.2 | development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-io-surface-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-io-surface-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-io-surface-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-io-surface-0.3.2/upstream/spdx/Zlib.txt) |
| objc2-quartz-core | 0.3.2 | development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-quartz-core-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-quartz-core-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-quartz-core-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-quartz-core-0.3.2/upstream/spdx/Zlib.txt) |
| objc2-web-kit | 0.3.2 | development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE.md](cargo/objc2-web-kit-0.3.2/upstream/objc2-7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md) · [MIT.txt](cargo/objc2-web-kit-0.3.2/upstream/spdx/MIT.txt) · [Apache-2.0.txt](cargo/objc2-web-kit-0.3.2/upstream/spdx/Apache-2.0.txt) · [Zlib.txt](cargo/objc2-web-kit-0.3.2/upstream/spdx/Zlib.txt) |
| objc2 | 0.6.5 | build, development, runtime | MIT | [LICENSE.md](cargo/objc2-0.6.5/upstream/objc2-d7d2fa23ceaa5e6096c923b081040e5d81b3b9df/LICENSE.md) · [MIT.txt](cargo/objc2-0.6.5/upstream/spdx/MIT.txt) |
| once_cell | 1.21.4 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/once_cell-1.21.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/once_cell-1.21.4/LICENSE-MIT) |
| option-ext | 0.2.0 | build, development, runtime | MPL-2.0 | [LICENSE.txt](cargo/option-ext-0.2.0/LICENSE.txt) |
| parking_lot | 0.12.5 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/parking_lot-0.12.5/LICENSE-APACHE) · [LICENSE-MIT](cargo/parking_lot-0.12.5/LICENSE-MIT) |
| parking_lot_core | 0.9.12 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/parking_lot_core-0.9.12/LICENSE-APACHE) · [LICENSE-MIT](cargo/parking_lot_core-0.9.12/LICENSE-MIT) |
| percent-encoding | 2.3.2 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/percent-encoding-2.3.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/percent-encoding-2.3.2/LICENSE-MIT) |
| phf | 0.13.1 | build, development, runtime | MIT | [LICENSE](cargo/phf-0.13.1/LICENSE) |
| phf_codegen | 0.13.1 | build, development | MIT | [LICENSE](cargo/phf_codegen-0.13.1/LICENSE) |
| phf_generator | 0.13.1 | build, development | MIT | [LICENSE](cargo/phf_generator-0.13.1/LICENSE) |
| phf_macros | 0.13.1 | build, development | MIT | [LICENSE](cargo/phf_macros-0.13.1/LICENSE) |
| phf_shared | 0.13.1 | build, development, runtime | MIT | [LICENSE](cargo/phf_shared-0.13.1/LICENSE) |
| pin-project-lite | 0.2.17 | development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/pin-project-lite-0.2.17/LICENSE-APACHE) · [LICENSE-MIT](cargo/pin-project-lite-0.2.17/LICENSE-MIT) |
| plist | 1.10.3 | build, development, runtime | MIT | [LICENCE](cargo/plist-1.10.3/LICENCE) |
| png | 0.18.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/png-0.18.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/png-0.18.1/LICENSE-MIT) |
| portable-pty | 0.9.0 | runtime | MIT | [LICENSE.md](cargo/portable-pty-0.9.0/LICENSE.md) |
| potential_utf | 0.1.6 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/potential_utf-0.1.6/LICENSE) |
| powerfmt | 0.2.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-Apache](cargo/powerfmt-0.2.1/LICENSE-Apache) · [LICENSE-MIT](cargo/powerfmt-0.2.1/LICENSE-MIT) |
| precomputed-hash | 0.1.1 | build, development, runtime | MIT | [LICENSE](cargo/precomputed-hash-0.1.1/LICENSE) |
| proc-macro2 | 1.0.107 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/proc-macro2-1.0.107/LICENSE-APACHE) · [LICENSE-MIT](cargo/proc-macro2-1.0.107/LICENSE-MIT) |
| pxfm | 0.1.30 | runtime | BSD-3-Clause OR Apache-2.0 | [LICENSE-APACHE.md](cargo/pxfm-0.1.30/LICENSE-APACHE.md) · [LICENSE.md](cargo/pxfm-0.1.30/LICENSE.md) |
| quick-error | 2.0.1 | runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/quick-error-2.0.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/quick-error-2.0.1/LICENSE-MIT) |
| quick-xml | 0.42.0 | build, development, runtime | MIT | [LICENSE-MIT.md](cargo/quick-xml-0.42.0/LICENSE-MIT.md) |
| quinn-proto | 0.11.19 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/quinn-proto-0.11.19/LICENSE-APACHE) · [LICENSE-MIT](cargo/quinn-proto-0.11.19/LICENSE-MIT) |
| quinn-udp | 0.5.16 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/quinn-udp-0.5.16/LICENSE-APACHE) · [LICENSE-MIT](cargo/quinn-udp-0.5.16/LICENSE-MIT) |
| quinn | 0.11.12 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/quinn-0.11.12/LICENSE-APACHE) · [LICENSE-MIT](cargo/quinn-0.11.12/LICENSE-MIT) |
| quote | 1.0.47 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/quote-1.0.47/LICENSE-APACHE) · [LICENSE-MIT](cargo/quote-1.0.47/LICENSE-MIT) |
| rand | 0.10.3 | runtime | MIT OR Apache-2.0 | [COPYRIGHT](cargo/rand-0.10.3/COPYRIGHT) · [LICENSE-APACHE](cargo/rand-0.10.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/rand-0.10.3/LICENSE-MIT) |
| rand_core | 0.10.1 | build, development, runtime | MIT OR Apache-2.0 | [COPYRIGHT](cargo/rand_core-0.10.1/COPYRIGHT) · [LICENSE-APACHE](cargo/rand_core-0.10.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/rand_core-0.10.1/LICENSE-MIT) |
| rand_pcg | 0.10.2 | runtime | MIT OR Apache-2.0 | [COPYRIGHT](cargo/rand_pcg-0.10.2/COPYRIGHT) · [LICENSE-APACHE](cargo/rand_pcg-0.10.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/rand_pcg-0.10.2/LICENSE-MIT) |
| raw-window-handle | 0.6.2 | development, runtime | MIT OR Apache-2.0 OR Zlib | [LICENSE-APACHE.md](cargo/raw-window-handle-0.6.2/LICENSE-APACHE.md) · [LICENSE-MIT.md](cargo/raw-window-handle-0.6.2/LICENSE-MIT.md) · [LICENSE-ZLIB.md](cargo/raw-window-handle-0.6.2/LICENSE-ZLIB.md) |
| ref-cast-impl | 1.0.27 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/ref-cast-impl-1.0.27/LICENSE-APACHE) · [LICENSE-MIT](cargo/ref-cast-impl-1.0.27/LICENSE-MIT) |
| ref-cast | 1.0.27 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/ref-cast-1.0.27/LICENSE-APACHE) · [LICENSE-MIT](cargo/ref-cast-1.0.27/LICENSE-MIT) |
| regex-automata | 0.4.18 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/regex-automata-0.4.18/LICENSE-APACHE) · [LICENSE-MIT](cargo/regex-automata-0.4.18/LICENSE-MIT) |
| regex-syntax | 0.8.11 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/regex-syntax-0.8.11/LICENSE-APACHE) · [LICENSE-MIT](cargo/regex-syntax-0.8.11/LICENSE-MIT) · [LICENSE-UNICODE](cargo/regex-syntax-0.8.11/src/unicode_tables/LICENSE-UNICODE) |
| regex | 1.13.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/regex-1.13.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/regex-1.13.1/LICENSE-MIT) |
| relative-path | 2.0.3 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/relative-path-2.0.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/relative-path-2.0.3/LICENSE-MIT) |
| reqwest | 0.12.28 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/reqwest-0.12.28/LICENSE-APACHE) · [LICENSE-MIT](cargo/reqwest-0.12.28/LICENSE-MIT) |
| rfd | 0.17.2 | runtime | MIT | [LICENSE](cargo/rfd-0.17.2/LICENSE) · [LICENSE](cargo/rfd-0.17.2/src/backend/xdg_desktop_portal/window_identifier/LICENSE) |
| ring | 0.17.14 | runtime | Apache-2.0 AND ISC | [LICENSE](cargo/ring-0.17.14/LICENSE) · [LICENSE-BoringSSL](cargo/ring-0.17.14/LICENSE-BoringSSL) · [LICENSE-other-bits](cargo/ring-0.17.14/LICENSE-other-bits) · [LICENSE-APACHE](cargo/ring-0.17.14/src/polyfill/once_cell/LICENSE-APACHE) · [LICENSE-MIT](cargo/ring-0.17.14/src/polyfill/once_cell/LICENSE-MIT) · [LICENSE](cargo/ring-0.17.14/third_party/fiat/LICENSE) |
| rquickjs-core | 0.14.0 | runtime | MIT | [LICENSE-MIT](cargo/rquickjs-core-0.14.0/LICENSE-MIT) |
| rquickjs-sys | 0.14.0 | runtime | MIT | [LICENSE](cargo/rquickjs-sys-0.14.0/quickjs/LICENSE) · [NOTICE.md](cargo/rquickjs-sys-0.14.0/vendor/wasi-libc/NOTICE.md) |
| rquickjs | 0.14.0 | runtime | MIT | [LICENSE](cargo/rquickjs-0.14.0/LICENSE) |
| rustc-hash | 2.1.3 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/rustc-hash-2.1.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/rustc-hash-2.1.3/LICENSE-MIT) |
| rustc_version | 0.4.1 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/rustc_version-0.4.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/rustc_version-0.4.1/LICENSE-MIT) |
| rustix | 1.1.6 | development, runtime | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [COPYRIGHT](cargo/rustix-1.1.6/COPYRIGHT) · [LICENSE-APACHE](cargo/rustix-1.1.6/LICENSE-APACHE) · [LICENSE-Apache-2.0_WITH_LLVM-exception](cargo/rustix-1.1.6/LICENSE-Apache-2.0_WITH_LLVM-exception) · [LICENSE-MIT](cargo/rustix-1.1.6/LICENSE-MIT) |
| rustls-pki-types | 1.15.1 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/rustls-pki-types-1.15.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/rustls-pki-types-1.15.1/LICENSE-MIT) |
| rustls-webpki | 0.103.16 | runtime | ISC | [LICENSE](cargo/rustls-webpki-0.103.16/LICENSE) |
| rustls | 0.23.46 | runtime | Apache-2.0 OR ISC OR MIT | [LICENSE-APACHE](cargo/rustls-0.23.46/LICENSE-APACHE) · [LICENSE-ISC](cargo/rustls-0.23.46/LICENSE-ISC) · [LICENSE-MIT](cargo/rustls-0.23.46/LICENSE-MIT) |
| ryu | 1.0.23 | runtime | Apache-2.0 OR BSL-1.0 | [LICENSE-APACHE](cargo/ryu-1.0.23/LICENSE-APACHE) · [LICENSE-BOOST](cargo/ryu-1.0.23/LICENSE-BOOST) |
| same-file | 1.0.6 | build, development, runtime | Unlicense/MIT | [COPYING](cargo/same-file-1.0.6/COPYING) · [LICENSE-MIT](cargo/same-file-1.0.6/LICENSE-MIT) · [UNLICENSE](cargo/same-file-1.0.6/UNLICENSE) |
| schemars | 0.8.22 | build, development, runtime | MIT | [LICENSE](cargo/schemars-0.8.22/LICENSE) |
| schemars | 0.9.0 | build, development, runtime | MIT | [LICENSE](cargo/schemars-0.9.0/LICENSE) |
| schemars | 1.2.3 | build, development, runtime | MIT | [LICENSE](cargo/schemars-1.2.3/LICENSE) |
| schemars_derive | 0.8.22 | build, development | MIT | [LICENSE](cargo/schemars_derive-0.8.22/LICENSE) |
| scopeguard | 1.2.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/scopeguard-1.2.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/scopeguard-1.2.0/LICENSE-MIT) |
| security-framework-sys | 2.17.0 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/security-framework-sys-2.17.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/security-framework-sys-2.17.0/LICENSE-MIT) |
| security-framework | 3.7.0 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/security-framework-3.7.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/security-framework-3.7.0/LICENSE-MIT) |
| selectors | 0.38.0 | build, development, runtime | MPL-2.0 | [MPL-2.0.txt](cargo/selectors-0.38.0/upstream/spdx/MPL-2.0.txt) |
| semver | 1.0.28 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/semver-1.0.28/LICENSE-APACHE) · [LICENSE-MIT](cargo/semver-1.0.28/LICENSE-MIT) |
| serde-untagged | 0.1.9 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde-untagged-0.1.9/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde-untagged-0.1.9/LICENSE-MIT) |
| serde | 1.0.229 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde-1.0.229/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde-1.0.229/LICENSE-MIT) |
| serde_core | 1.0.229 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_core-1.0.229/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_core-1.0.229/LICENSE-MIT) |
| serde_derive | 1.0.229 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_derive-1.0.229/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_derive-1.0.229/LICENSE-MIT) |
| serde_derive_internals | 0.29.1 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_derive_internals-0.29.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_derive_internals-0.29.1/LICENSE-MIT) |
| serde_json | 1.0.154 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_json-1.0.154/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_json-1.0.154/LICENSE-MIT) |
| serde_repr | 0.1.21 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_repr-0.1.21/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_repr-0.1.21/LICENSE-MIT) |
| serde_spanned | 1.1.2 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_spanned-1.1.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_spanned-1.1.2/LICENSE-MIT) |
| serde_urlencoded | 0.7.1 | runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/serde_urlencoded-0.7.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_urlencoded-0.7.1/LICENSE-MIT) |
| serde_with | 3.24.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_with-3.24.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_with-3.24.0/LICENSE-MIT) |
| serde_with_macros | 3.24.0 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serde_with_macros-3.24.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/serde_with_macros-3.24.0/LICENSE-MIT) |
| serial2 | 0.2.39 | runtime | BSD-2-Clause OR Apache-2.0 | [LICENSE-APACHE](cargo/serial2-0.2.39/LICENSE-APACHE) · [LICENSE-BSD](cargo/serial2-0.2.39/LICENSE-BSD) |
| serialize-to-javascript-impl | 0.1.2 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serialize-to-javascript-impl-0.1.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/serialize-to-javascript-impl-0.1.2/LICENSE-MIT) |
| serialize-to-javascript | 0.1.2 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/serialize-to-javascript-0.1.2/LICENSE-APACHE) · [LICENSE-MIT](cargo/serialize-to-javascript-0.1.2/LICENSE-MIT) |
| servo_arc | 0.4.3 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/servo_arc-0.4.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/servo_arc-0.4.3/LICENSE-MIT) |
| sha2 | 0.10.9 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/sha2-0.10.9/LICENSE-APACHE) · [LICENSE-MIT](cargo/sha2-0.10.9/LICENSE-MIT) |
| shell-words | 1.1.1 | runtime | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/shell-words-1.1.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/shell-words-1.1.1/LICENSE-MIT) |
| shlex | 2.0.1 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/shlex-2.0.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/shlex-2.0.1/LICENSE-MIT) |
| signal-hook-registry | 1.4.8 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/signal-hook-registry-1.4.8/LICENSE-APACHE) · [LICENSE-MIT](cargo/signal-hook-registry-1.4.8/LICENSE-MIT) |
| simd-adler32 | 0.3.10 | build, development, runtime | MIT | [LICENSE.md](cargo/simd-adler32-0.3.10/LICENSE.md) |
| siphasher | 1.0.4 | build, development, runtime | MIT OR Apache-2.0 | [COPYING](cargo/siphasher-1.0.4/COPYING) · [LICENSE-APACHE](cargo/siphasher-1.0.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/siphasher-1.0.4/LICENSE-MIT) |
| slab | 0.4.12 | runtime | MIT | [LICENSE](cargo/slab-0.4.12/LICENSE) |
| smallvec | 1.16.4 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/smallvec-1.16.4/LICENSE-APACHE) · [LICENSE-MIT](cargo/smallvec-1.16.4/LICENSE-MIT) |
| socket2 | 0.6.5 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/socket2-0.6.5/LICENSE-APACHE) · [LICENSE-MIT](cargo/socket2-0.6.5/LICENSE-MIT) |
| stable_deref_trait | 1.2.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/stable_deref_trait-1.2.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/stable_deref_trait-1.2.1/LICENSE-MIT) |
| static_vcruntime | 3.0.0 | build, development | MIT OR Apache-2.0 OR Zlib | [LICENSE](cargo/static_vcruntime-3.0.0/LICENSE) · [LICENSE-APACHE](cargo/static_vcruntime-3.0.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/static_vcruntime-3.0.0/LICENSE-MIT) · [LICENSE-ZLIB](cargo/static_vcruntime-3.0.0/LICENSE-ZLIB) |
| string_cache | 0.9.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/string_cache-0.9.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/string_cache-0.9.0/LICENSE-MIT) |
| string_cache_codegen | 0.6.1 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/string_cache_codegen-0.6.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/string_cache_codegen-0.6.1/LICENSE-MIT) |
| strsim | 0.11.1 | build, development | MIT | [LICENSE](cargo/strsim-0.11.1/LICENSE) |
| subtle | 2.6.1 | runtime | BSD-3-Clause | [LICENSE](cargo/subtle-2.6.1/LICENSE) |
| swift-rs | 1.0.9 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/swift-rs-1.0.9/LICENSE-APACHE) · [LICENSE-MIT](cargo/swift-rs-1.0.9/LICENSE-MIT) |
| syn | 2.0.119 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/syn-2.0.119/LICENSE-APACHE) · [LICENSE-MIT](cargo/syn-2.0.119/LICENSE-MIT) |
| syn | 3.0.9 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/syn-3.0.9/LICENSE-APACHE) · [LICENSE-MIT](cargo/syn-3.0.9/LICENSE-MIT) |
| sync_wrapper | 1.0.2 | runtime | Apache-2.0 | [LICENSE](cargo/sync_wrapper-1.0.2/LICENSE) |
| synstructure | 0.14.0 | build, development | MIT | [LICENSE](cargo/synstructure-0.14.0/LICENSE) |
| tao | 0.37.2 | development, runtime | Apache-2.0 | [LICENSE](cargo/tao-0.37.2/LICENSE) · [LICENSE.spdx](cargo/tao-0.37.2/LICENSE.spdx) |
| tauri-build | 2.7.4 | build, development | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-build-2.7.4/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-build-2.7.4/LICENSE-MIT) |
| tauri-codegen | 2.7.4 | build, development | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-codegen-2.7.4/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-codegen-2.7.4/LICENSE-MIT) |
| tauri-macros | 2.7.4 | build, development | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-macros-2.7.4/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-macros-2.7.4/LICENSE-MIT) |
| tauri-plugin-dialog | 2.8.4 | runtime | Apache-2.0 OR MIT | [LICENSE.spdx](cargo/tauri-plugin-dialog-2.8.4/LICENSE.spdx) · [LICENSE_APACHE-2.0](cargo/tauri-plugin-dialog-2.8.4/LICENSE_APACHE-2.0) · [LICENSE_MIT](cargo/tauri-plugin-dialog-2.8.4/LICENSE_MIT) |
| tauri-plugin-fs | 2.7.1 | runtime | Apache-2.0 OR MIT | [LICENSE.spdx](cargo/tauri-plugin-fs-2.7.1/LICENSE.spdx) · [LICENSE_APACHE-2.0](cargo/tauri-plugin-fs-2.7.1/LICENSE_APACHE-2.0) · [LICENSE_MIT](cargo/tauri-plugin-fs-2.7.1/LICENSE_MIT) |
| tauri-plugin | 2.7.2 | build | Apache-2.0 OR MIT | [LICENSE-MIT](cargo/tauri-plugin-2.7.2/upstream/tauri-plugin-2.7.2/LICENSE-MIT) · [LICENSE-APACHE-2.0](cargo/tauri-plugin-2.7.2/upstream/tauri-plugin-2.7.2/LICENSE-APACHE-2.0) |
| tauri-runtime-wry | 2.12.3 | development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-runtime-wry-2.12.3/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-runtime-wry-2.12.3/LICENSE-MIT) |
| tauri-runtime | 2.12.2 | development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-runtime-2.12.2/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-runtime-2.12.2/LICENSE-MIT) |
| tauri-utils | 2.10.2 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-utils-2.10.2/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-utils-2.10.2/LICENSE-MIT) |
| tauri-winres | 0.3.7 | build, development | MIT | [LICENSE](cargo/tauri-winres-0.3.7/LICENSE) |
| tauri | 2.12.5 | development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE-2.0](cargo/tauri-2.12.5/LICENSE-APACHE-2.0) · [LICENSE-MIT](cargo/tauri-2.12.5/LICENSE-MIT) |
| tempfile | 3.27.0 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/tempfile-3.27.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/tempfile-3.27.0/LICENSE-MIT) |
| tendril | 0.5.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/tendril-0.5.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/tendril-0.5.1/LICENSE-MIT) |
| thiserror-impl | 1.0.69 | build | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/thiserror-impl-1.0.69/LICENSE-APACHE) · [LICENSE-MIT](cargo/thiserror-impl-1.0.69/LICENSE-MIT) |
| thiserror-impl | 2.0.21 | build, development | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/thiserror-impl-2.0.21/LICENSE-APACHE) · [LICENSE-MIT](cargo/thiserror-impl-2.0.21/LICENSE-MIT) |
| thiserror | 1.0.69 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/thiserror-1.0.69/LICENSE-APACHE) · [LICENSE-MIT](cargo/thiserror-1.0.69/LICENSE-MIT) |
| thiserror | 2.0.21 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/thiserror-2.0.21/LICENSE-APACHE) · [LICENSE-MIT](cargo/thiserror-2.0.21/LICENSE-MIT) |
| time-core | 0.1.9 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-Apache](cargo/time-core-0.1.9/LICENSE-Apache) · [LICENSE-MIT](cargo/time-core-0.1.9/LICENSE-MIT) |
| time-macros | 0.2.32 | build, development | MIT OR Apache-2.0 | [LICENSE-Apache](cargo/time-macros-0.2.32/LICENSE-Apache) · [LICENSE-MIT](cargo/time-macros-0.2.32/LICENSE-MIT) |
| time | 0.3.55 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-Apache](cargo/time-0.3.55/LICENSE-Apache) · [LICENSE-MIT](cargo/time-0.3.55/LICENSE-MIT) |
| tinystr | 0.8.5 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/tinystr-0.8.5/LICENSE) |
| tinyvec | 1.13.3 | build, development, runtime | Zlib OR Apache-2.0 OR MIT | [LICENSE-APACHE.md](cargo/tinyvec-1.13.3/LICENSE-APACHE.md) · [LICENSE-MIT.md](cargo/tinyvec-1.13.3/LICENSE-MIT.md) · [LICENSE-ZLIB.md](cargo/tinyvec-1.13.3/LICENSE-ZLIB.md) |
| tokio-macros | 2.7.2 | build, development | MIT | [LICENSE](cargo/tokio-macros-2.7.2/LICENSE) |
| tokio-rustls | 0.26.6 | runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/tokio-rustls-0.26.6/LICENSE-APACHE) · [LICENSE-MIT](cargo/tokio-rustls-0.26.6/LICENSE-MIT) |
| tokio | 1.54.1 | development, runtime | MIT | [LICENSE](cargo/tokio-1.54.1/LICENSE) |
| toml | 1.1.8+spec-1.1.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/toml-1.1.8+spec-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/toml-1.1.8+spec-1.1.0/LICENSE-MIT) |
| toml_datetime | 1.1.2+spec-1.1.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/toml_datetime-1.1.2+spec-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/toml_datetime-1.1.2+spec-1.1.0/LICENSE-MIT) |
| toml_parser | 1.1.5+spec-1.1.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/toml_parser-1.1.5+spec-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/toml_parser-1.1.5+spec-1.1.0/LICENSE-MIT) |
| toml_writer | 1.1.3+spec-1.1.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/toml_writer-1.1.3+spec-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/toml_writer-1.1.3+spec-1.1.0/LICENSE-MIT) |
| tower-http | 0.6.11 | runtime | MIT | [LICENSE](cargo/tower-http-0.6.11/LICENSE) |
| tower-layer | 0.3.3 | runtime | MIT | [LICENSE](cargo/tower-layer-0.3.3/LICENSE) |
| tower-service | 0.3.3 | runtime | MIT | [LICENSE](cargo/tower-service-0.3.3/LICENSE) |
| tower | 0.5.3 | runtime | MIT | [LICENSE](cargo/tower-0.5.3/LICENSE) |
| tracing-attributes | 0.1.31 | build | MIT | [LICENSE](cargo/tracing-attributes-0.1.31/LICENSE) |
| tracing-core | 0.1.36 | runtime | MIT | [LICENSE](cargo/tracing-core-0.1.36/LICENSE) · [LICENSE](cargo/tracing-core-0.1.36/src/spin/LICENSE) |
| tracing | 0.1.44 | runtime | MIT | [LICENSE](cargo/tracing-0.1.44/LICENSE) |
| trash | 5.2.9 | runtime | MIT | [LICENSE.txt](cargo/trash-5.2.9/LICENSE.txt) |
| tray-icon | 0.25.1 | development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/tray-icon-0.25.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/tray-icon-0.25.1/LICENSE-MIT) · [LICENSE.spdx](cargo/tray-icon-0.25.1/LICENSE.spdx) |
| try-lock | 0.2.5 | runtime | MIT | [LICENSE](cargo/try-lock-0.2.5/LICENSE) |
| typeid | 1.0.3 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/typeid-1.0.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/typeid-1.0.3/LICENSE-MIT) |
| typenum | 1.20.1 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE](cargo/typenum-1.20.1/LICENSE) · [LICENSE-APACHE](cargo/typenum-1.20.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/typenum-1.20.1/LICENSE-MIT) |
| unicode-ident | 1.0.27 | build, development, runtime | (MIT OR Apache-2.0) AND Unicode-3.0 | [LICENSE-APACHE](cargo/unicode-ident-1.0.27/LICENSE-APACHE) · [LICENSE-MIT](cargo/unicode-ident-1.0.27/LICENSE-MIT) · [LICENSE-UNICODE](cargo/unicode-ident-1.0.27/LICENSE-UNICODE) |
| untrusted | 0.9.0 | runtime | ISC | [LICENSE.txt](cargo/untrusted-0.9.0/LICENSE.txt) |
| url | 2.5.8 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/url-2.5.8/LICENSE-APACHE) · [LICENSE-MIT](cargo/url-2.5.8/LICENSE-MIT) |
| urlpattern | 0.6.0 | build, development, runtime | MIT | [LICENSE](cargo/urlpattern-0.6.0/LICENSE) |
| utf8_iter | 1.1.0 | build, development, runtime | Apache-2.0 OR MIT | [COPYRIGHT](cargo/utf8_iter-1.1.0/COPYRIGHT) · [LICENSE-APACHE](cargo/utf8_iter-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/utf8_iter-1.1.0/LICENSE-MIT) |
| utf_types | 1.0.0 | build, development, runtime | Apache-2.0 OR MIT | [COPYRIGHT](cargo/utf_types-1.0.0/COPYRIGHT) · [LICENSE-APACHE](cargo/utf_types-1.0.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/utf_types-1.0.0/LICENSE-MIT) |
| uuid | 1.29.0 | build, development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/uuid-1.29.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/uuid-1.29.0/LICENSE-MIT) |
| version_check | 0.9.5 | build, development | MIT/Apache-2.0 | [LICENSE-APACHE](cargo/version_check-0.9.5/LICENSE-APACHE) · [LICENSE-MIT](cargo/version_check-0.9.5/LICENSE-MIT) |
| walkdir | 2.5.0 | build, development, runtime | Unlicense/MIT | [COPYING](cargo/walkdir-2.5.0/COPYING) · [LICENSE-MIT](cargo/walkdir-2.5.0/LICENSE-MIT) · [UNLICENSE](cargo/walkdir-2.5.0/UNLICENSE) |
| want | 0.3.2 | runtime | MIT | [LICENSE](cargo/want-0.3.2/LICENSE) |
| web-time | 1.1.0 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/web-time-1.1.0/LICENSE-APACHE) · [LICENSE-MIT](cargo/web-time-1.1.0/LICENSE-MIT) |
| web_atoms | 0.2.6 | build, development, runtime | MIT OR Apache-2.0 | [LICENSE-APACHE](cargo/web_atoms-0.2.6/LICENSE-APACHE) · [LICENSE-MIT](cargo/web_atoms-0.2.6/LICENSE-MIT) |
| webpki-roots | 1.0.11 | runtime | CDLA-Permissive-2.0 | [LICENSE](cargo/webpki-roots-1.0.11/LICENSE) |
| window-vibrancy | 0.8.1 | development, runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/window-vibrancy-0.8.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/window-vibrancy-0.8.1/LICENSE-MIT) · [LICENSE.spdx](cargo/window-vibrancy-0.8.1/LICENSE.spdx) |
| winnow | 1.0.4 | build, development, runtime | MIT | [LICENSE-MIT](cargo/winnow-1.0.4/LICENSE-MIT) |
| writeable | 0.6.4 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/writeable-0.6.4/LICENSE) |
| wry | 0.57.1 | development, runtime | Apache-2.0 OR MIT | [.license_template](cargo/wry-0.57.1/.license_template) · [LICENSE-APACHE](cargo/wry-0.57.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/wry-0.57.1/LICENSE-MIT) · [LICENSE.spdx](cargo/wry-0.57.1/LICENSE.spdx) |
| yoke-derive | 0.8.4 | build, development | Unicode-3.0 | [LICENSE](cargo/yoke-derive-0.8.4/LICENSE) |
| yoke | 0.8.4 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/yoke-0.8.4/LICENSE) |
| zerofrom-derive | 0.1.8 | build, development | Unicode-3.0 | [LICENSE](cargo/zerofrom-derive-0.1.8/LICENSE) |
| zerofrom | 0.1.8 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/zerofrom-0.1.8/LICENSE) |
| zeroize | 1.9.1 | runtime | Apache-2.0 OR MIT | [LICENSE-APACHE](cargo/zeroize-1.9.1/LICENSE-APACHE) · [LICENSE-MIT](cargo/zeroize-1.9.1/LICENSE-MIT) |
| zerotrie | 0.2.5 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/zerotrie-0.2.5/LICENSE) |
| zerovec-derive | 0.11.7 | build, development | Unicode-3.0 | [LICENSE](cargo/zerovec-derive-0.11.7/LICENSE) |
| zerovec | 0.11.9 | build, development, runtime | Unicode-3.0 | [LICENSE](cargo/zerovec-0.11.9/LICENSE) |
| zip | 2.6.1 | runtime | MIT | [LICENSE](cargo/zip-2.6.1/LICENSE) |
| zlib-rs | 0.6.8 | build, development, runtime | Zlib | [LICENSE](cargo/zlib-rs-0.6.8/LICENSE) |
| zmij | 1.0.23 | build, development, runtime | MIT | [LICENSE-MIT](cargo/zmij-1.0.23/LICENSE-MIT) |
| zopfli | 0.8.4 | runtime | Apache-2.0 | [COPYING](cargo/zopfli-0.8.4/COPYING) |
| zune-core | 0.5.3 | runtime | MIT OR Apache-2.0 OR Zlib | [LICENSE-APACHE](cargo/zune-core-0.5.3/LICENSE-APACHE) · [LICENSE-MIT](cargo/zune-core-0.5.3/LICENSE-MIT) · [LICENSE-ZLIB](cargo/zune-core-0.5.3/LICENSE-ZLIB) |
| zune-jpeg | 0.5.15 | runtime | MIT OR Apache-2.0 OR Zlib | [LICENSE-APACHE](cargo/zune-jpeg-0.5.15/LICENSE-APACHE) · [LICENSE-MIT](cargo/zune-jpeg-0.5.15/LICENSE-MIT) · [LICENSE-ZLIB](cargo/zune-jpeg-0.5.15/LICENSE-ZLIB) |
