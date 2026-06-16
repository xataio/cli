# xata-cli

## 1.4.1

### Patch Changes

- [#2601](https://github.com/xataio/frontend/pull/2601) [`5779d12`](https://github.com/xataio/frontend/commit/5779d12fabe0589e37b0325ade77753ca46d9d41) Thanks [@divyenduz](https://github.com/divyenduz)! - unhide xata branch metrics/logs command

## 1.4.0

### Minor Changes

- [#2590](https://github.com/xataio/frontend/pull/2590) [`e43ad59`](https://github.com/xataio/frontend/commit/e43ad599757bae98575cf5d34cd0600bdb808712) Thanks [@SferaDev](https://github.com/SferaDev)! - Add support for logging in with an API key via `xata auth login --api-key <key>`. This is a non-interactive alternative to the browser-based device OAuth flow, and the key is validated before being stored.

## 1.3.2

### Patch Changes

- [#2591](https://github.com/xataio/frontend/pull/2591) [`0be09e1`](https://github.com/xataio/frontend/commit/0be09e187d10c22aaffbb7cc0396dfef8ca86a32) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata branch logs command

## 1.3.1

### Patch Changes

- [#2562](https://github.com/xataio/frontend/pull/2562) [`8d77436`](https://github.com/xataio/frontend/commit/8d77436a3df38d4cd69b72d0d97669ed161b63ce) Thanks [@divyenduz](https://github.com/divyenduz)! - On demand fast branch via xata sandbox

## 1.3.0

### Minor Changes

- [#2524](https://github.com/xataio/frontend/pull/2524) [`19f931a`](https://github.com/xataio/frontend/commit/19f931a84902e351aa5b75118561635b69d0e8cb) Thanks [@SferaDev](https://github.com/SferaDev)! - [cli] Simplify custom profiles

### Patch Changes

- [#2530](https://github.com/xataio/frontend/pull/2530) [`5fc9b95`](https://github.com/xataio/frontend/commit/5fc9b955fd4b5be4791adbed218471abdbba456e) Thanks [@divyenduz](https://github.com/divyenduz)! - in xata branch metrics add -w as alias for --watch

## 1.2.4

### Patch Changes

- [#2525](https://github.com/xataio/frontend/pull/2525) [`15018a0`](https://github.com/xataio/frontend/commit/15018a01e31f1ccc2e396783821f1dc09e6994ef) Thanks [@divyenduz](https://github.com/divyenduz)! - unify table library to one place

## 1.2.3

### Patch Changes

- [#2523](https://github.com/xataio/frontend/pull/2523) [`2d7e6b3`](https://github.com/xataio/frontend/commit/2d7e6b32c255998bb10a1185cba0574d9934d985) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata branch metrics

- [#2519](https://github.com/xataio/frontend/pull/2519) [`a1cefd5`](https://github.com/xataio/frontend/commit/a1cefd5154f88a8dceb164f55ac026f8d30e8319) Thanks [@divyenduz](https://github.com/divyenduz)! - make all prompts filterable on typing

## 1.2.2

### Patch Changes

- [#2490](https://github.com/xataio/frontend/pull/2490) [`34da9b2`](https://github.com/xataio/frontend/commit/34da9b25a38c3b4a625526554e26e78e178861d1) Thanks [@richardgill](https://github.com/richardgill)! - Add CLI invocation IDs to X-Xata-Agent telemetry headers.

## 1.2.1

### Patch Changes

- [#2319](https://github.com/xataio/frontend/pull/2319) [`abf8f7b`](https://github.com/xataio/frontend/commit/abf8f7b089b6c55e6ba278675a574a735bc680b1) Thanks [@divyenduz](https://github.com/divyenduz)! - When CLI is running inside an agent context, make it not-interactive.

## 1.2.0

### Minor Changes

- [#2244](https://github.com/xataio/frontend/pull/2244) [`c4edf9f`](https://github.com/xataio/frontend/commit/c4edf9f32553f4cfb5d439568d07e9a0b2676c4c) Thanks [@kvch](https://github.com/kvch)! - Add a new option for xata branch url to retrieve connection string for poolers

## 1.1.5

### Patch Changes

- [#2295](https://github.com/xataio/frontend/pull/2295) [`1a3cd21`](https://github.com/xataio/frontend/commit/1a3cd212952b9a814cf540795e5cb5427b342486) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata branch set postgres-version

- [#2294](https://github.com/xataio/frontend/pull/2294) [`a277e06`](https://github.com/xataio/frontend/commit/a277e0691da6bbc3e3f0cc2b1a1e9ecaf334f0c7) Thanks [@divyenduz](https://github.com/divyenduz)! - xata branch rotate-password

## 1.1.4

### Patch Changes

- [#2272](https://github.com/xataio/frontend/pull/2272) [`93d5f05`](https://github.com/xataio/frontend/commit/93d5f057326635f04886ed4f263e1ee65702bd5c) Thanks [@divyenduz](https://github.com/divyenduz)! - default to latest postgres image available

## 1.1.3

### Patch Changes

- [#2267](https://github.com/xataio/frontend/pull/2267) [`d9e0ce6`](https://github.com/xataio/frontend/commit/d9e0ce6dea8c800f096f43feff4032b2479bf841) Thanks [@divyenduz](https://github.com/divyenduz)! - sort postgres versions DESC

- [#2263](https://github.com/xataio/frontend/pull/2263) [`9d164a5`](https://github.com/xataio/frontend/commit/9d164a5e98056a01b117c0fe537aaf0356326472) Thanks [@divyenduz](https://github.com/divyenduz)! - hide pricing when environment is local, minor pricing UI improvements

## 1.1.2

### Patch Changes

- Updated dependencies [[`c34be69`](https://github.com/xataio/frontend/commit/c34be699fb81b2e199a3e5ea1ca38431560c4c87)]:
  - @xata.io/pgstream@0.2.0
  - @xata.io/pgroll@0.9.0
  - @xata.io/utils@0.1.0
  - @xata.io/ai@0.1.0
  - @xata.io/sql@0.1.3
  - @xata.io/config@0.0.0

## 1.1.1

### Patch Changes

- [#2206](https://github.com/xataio/frontend/pull/2206) [`0d9d48e`](https://github.com/xataio/frontend/commit/0d9d48e9cb21287f630e2e631ea8ab7d787d19d4) Thanks [@richardgill](https://github.com/richardgill)! - Add CI vendor, CI PR, and AI agent detection to X-Xata-Agent header

## 1.1.0

### Minor Changes

- [#2194](https://github.com/xataio/frontend/pull/2194) [`1ae7443`](https://github.com/xataio/frontend/commit/1ae7443dfeec57c334b2b409ce12b2a882b01f0f) Thanks [@richardgill](https://github.com/richardgill)! - Add client telemetry headers for service identification

## 1.0.110

### Patch Changes

- [#2165](https://github.com/xataio/frontend/pull/2165) [`017843b`](https://github.com/xataio/frontend/commit/017843b64d3f936d8988fdf6b6d94f84d49ccbef) Thanks [@divyenduz](https://github.com/divyenduz)! - fix EXDEV, do atomic rename from the same directory

## 1.0.109

### Patch Changes

- [#2160](https://github.com/xataio/frontend/pull/2160) [`5757756`](https://github.com/xataio/frontend/commit/5757756a151331ab5db68e64995610f4d4e5740b) Thanks [@SferaDev](https://github.com/SferaDev)! - Add debug logging for XATA_API_KEY environment variable

- [#2161](https://github.com/xataio/frontend/pull/2161) [`6e1a66c`](https://github.com/xataio/frontend/commit/6e1a66c55f2d7af8e1e838ae3181c0d13cdc3b01) Thanks [@tsg](https://github.com/tsg)! - update pgstream to 0.9.11

- [#2163](https://github.com/xataio/frontend/pull/2163) [`3be5143`](https://github.com/xataio/frontend/commit/3be51437720ef2100f8f0af517a96a66e29b638e) Thanks [@divyenduz](https://github.com/divyenduz)! - show download progress for pgroll, pgstream binaries

## 1.0.108

### Patch Changes

- [#2150](https://github.com/xataio/frontend/pull/2150) [`3d5ab94`](https://github.com/xataio/frontend/commit/3d5ab94deb0a27476d18b6e94c9bfc00e51c476b) Thanks [@tsg](https://github.com/tsg)! - update pgstream to 0.9.10

## 1.0.107

### Patch Changes

- [#2143](https://github.com/xataio/frontend/pull/2143) [`7ceeb41`](https://github.com/xataio/frontend/commit/7ceeb41e0859a005347bb0a8e94229f3839eaa87) Thanks [@tsg](https://github.com/tsg)! - update pgstream to 0.9.9

## 1.0.106

### Patch Changes

- [#2084](https://github.com/xataio/frontend/pull/2084) [`f5b40d2`](https://github.com/xataio/frontend/commit/f5b40d2e5268345a4b5662ed90e69cceb310c4b6) Thanks [@SferaDev](https://github.com/SferaDev)! - Add IP filtering project settings

## 1.0.105

### Patch Changes

- [#2112](https://github.com/xataio/frontend/pull/2112) [`3a7e5b6`](https://github.com/xataio/frontend/commit/3a7e5b668188c66f316f80c05cb938744b67d6d4) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgroll to 0.16.1, better pgroll binary mismatch error

## 1.0.104

### Patch Changes

- [#2063](https://github.com/xataio/frontend/pull/2063) [`b3e020c`](https://github.com/xataio/frontend/commit/b3e020c787f421e163663191c34ad2adcfde6247) Thanks [@SferaDev](https://github.com/SferaDev)! - Add custom environment support for auth login commands

- [#2047](https://github.com/xataio/frontend/pull/2047) [`d3d0bd6`](https://github.com/xataio/frontend/commit/d3d0bd60f7c532fe8528227dfbcbfc673a867d4c) Thanks [@SferaDev](https://github.com/SferaDev)! - Add skip-ddl-tracking flag to clone stream command

- [#2041](https://github.com/xataio/frontend/pull/2041) [`1c402cd`](https://github.com/xataio/frontend/commit/1c402cd1dbbfcf89d6a8305947d5d0e0379a1ee2) Thanks [@divyenduz](https://github.com/divyenduz)! - add some basic tests for the compiled binary

## 1.0.103

### Patch Changes

- [#2037](https://github.com/xataio/frontend/pull/2037) [`b1e03f3`](https://github.com/xataio/frontend/commit/b1e03f380be1e2eadab4b914138decd7c5fc1a13) Thanks [@SferaDev](https://github.com/SferaDev)! - Revert "fix: branch list, tree, don't prompt for branch id"

## 1.0.102

### Patch Changes

- [#2030](https://github.com/xataio/frontend/pull/2030) [`8513814`](https://github.com/xataio/frontend/commit/851381431f1eca7e95fa8af86bf81870a4eb5ce9) Thanks [@divyenduz](https://github.com/divyenduz)! - don't ask for branch id in branch list, if not provided

## 1.0.101

### Patch Changes

- [#2022](https://github.com/xataio/frontend/pull/2022) [`b9cedf7`](https://github.com/xataio/frontend/commit/b9cedf7cba769b596c7dd938758a5e3caea52e3b) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.9.7

- [#2024](https://github.com/xataio/frontend/pull/2024) [`3265f5e`](https://github.com/xataio/frontend/commit/3265f5e5433a7d76e3462ff7b1cdefa5ad676670) Thanks [@SferaDev](https://github.com/SferaDev)! - Refactor backup list command to use getBackup with branch ID

## 1.0.100

### Patch Changes

- [#1811](https://github.com/xataio/frontend/pull/1811) [`87ba0c9`](https://github.com/xataio/frontend/commit/87ba0c94180b1cd6a3a7c3904c8d3458f607b640) Thanks [@SferaDev](https://github.com/SferaDev)! - [Keycloak] Add new commands for invitations and memberships

## 1.0.99

### Patch Changes

- [#1923](https://github.com/xataio/frontend/pull/1923) [`fa28f2e`](https://github.com/xataio/frontend/commit/fa28f2eea5f3b3377ad3210f25b7fe1ee7548c71) Thanks [@divyenduz](https://github.com/divyenduz)! - validate the output of xata clone config --mode=ai with pgstream validate

- [#1923](https://github.com/xataio/frontend/pull/1923) [`fa28f2e`](https://github.com/xataio/frontend/commit/fa28f2eea5f3b3377ad3210f25b7fe1ee7548c71) Thanks [@divyenduz](https://github.com/divyenduz)! - Update pgstream to 0.9.4

## 1.0.98

### Patch Changes

- [#1915](https://github.com/xataio/frontend/pull/1915) [`057afbb`](https://github.com/xataio/frontend/commit/057afbb6f6f5d85204a924ce233e43b01c0bb531) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata clone config --mode=ai

## 1.0.97

### Patch Changes

- [#1865](https://github.com/xataio/frontend/pull/1865) [`bde4dda`](https://github.com/xataio/frontend/commit/bde4dda6a15b1fa310d70c68de64ff79220ed297) Thanks [@divyenduz](https://github.com/divyenduz)! - reveal branch status when not healthy

- [#1822](https://github.com/xataio/frontend/pull/1822) [`d4e7815`](https://github.com/xataio/frontend/commit/d4e7815c1dfa774c15d8ec76aed87d17d2514ee5) Thanks [@SferaDev](https://github.com/SferaDev)! - Show organization regions with a tag

## 1.0.96

### Patch Changes

- [#1858](https://github.com/xataio/frontend/pull/1858) [`757a5d2`](https://github.com/xataio/frontend/commit/757a5d2314ecd77912a3b520ec8aa15c9b813930) Thanks [@SferaDev](https://github.com/SferaDev)! - Update pgstream to 0.9.3

## 1.0.95

### Patch Changes

- [#1836](https://github.com/xataio/frontend/pull/1836) [`c729a0e`](https://github.com/xataio/frontend/commit/c729a0eab91a94d0f253f7efcdf3338b257407dc) Thanks [@divyenduz](https://github.com/divyenduz)! - add command to download claude skill

## 1.0.94

### Patch Changes

- [#1803](https://github.com/xataio/frontend/pull/1803) [`555c285`](https://github.com/xataio/frontend/commit/555c285ba93c32ed7c10988982e617561f7954bc) Thanks [@SferaDev](https://github.com/SferaDev)! - Add check for hibernated in wait-ready

## 1.0.93

### Patch Changes

- [#1813](https://github.com/xataio/frontend/pull/1813) [`348d0bb`](https://github.com/xataio/frontend/commit/348d0bb30a5d9ad20dab78df66fb445c9e74cf2b) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.9.1

## 1.0.92

### Patch Changes

- [#1774](https://github.com/xataio/frontend/pull/1774) [`f1c38a8`](https://github.com/xataio/frontend/commit/f1c38a800a7c000032b3747b9f21c2158828bb9c) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - stop using latestRestore field

## 1.0.91

### Patch Changes

- [#1717](https://github.com/xataio/frontend/pull/1717) [`7e2a539`](https://github.com/xataio/frontend/commit/7e2a539b3ed11bb7005e4a1f62f48d30a3e8284d) Thanks [@divyenduz](https://github.com/divyenduz)! - add --skip-download flag to version command

## 1.0.90

### Patch Changes

- [#1712](https://github.com/xataio/frontend/pull/1712) [`f8ee851`](https://github.com/xataio/frontend/commit/f8ee85119968c13c33c0574015ff6abe3fa14699) Thanks [@divyenduz](https://github.com/divyenduz)! - eagerly download pgroll pgstream on xata version

## 1.0.89

### Patch Changes

- [#1709](https://github.com/xataio/frontend/pull/1709) [`bce7ecb`](https://github.com/xataio/frontend/commit/bce7ecb1587540020de3ac76179a57e2bed6a477) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.8.9

## 1.0.88

### Patch Changes

- [#1705](https://github.com/xataio/frontend/pull/1705) [`2c6e977`](https://github.com/xataio/frontend/commit/2c6e9770cb48554faee098b77a6c9589e73fbbde) Thanks [@divyenduz](https://github.com/divyenduz)! - return connection string when branch is hibernated

## 1.0.87

### Patch Changes

- [#1643](https://github.com/xataio/frontend/pull/1643) [`fa35fbe`](https://github.com/xataio/frontend/commit/fa35fbe4aa1c5a4f73cce33f8592d2f7a8c208ce) Thanks [@divyenduz](https://github.com/divyenduz)! - Prepare xata CLI for xatautils change

- [#1643](https://github.com/xataio/frontend/pull/1643) [`fa35fbe`](https://github.com/xataio/frontend/commit/fa35fbe4aa1c5a4f73cce33f8592d2f7a8c208ce) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata clone start --copy-roles flag to copy roles when using xata clone

## 1.0.86

### Patch Changes

- [#1678](https://github.com/xataio/frontend/pull/1678) [`cbda167`](https://github.com/xataio/frontend/commit/cbda16771902af88312af159166ba9e889d9786c) Thanks [@divyenduz](https://github.com/divyenduz)! - fix: only update child instance type if the relevant flag is provided

## 1.0.85

### Patch Changes

- [#1675](https://github.com/xataio/frontend/pull/1675) [`c6a24e6`](https://github.com/xataio/frontend/commit/c6a24e68430ee5b0cb7fc96076187132b227229c) Thanks [@divyenduz](https://github.com/divyenduz)! - fix: update branch instance type after child branch creation

- [#1671](https://github.com/xataio/frontend/pull/1671) [`cf52666`](https://github.com/xataio/frontend/commit/cf52666232508e593c281d5020443f8710084055) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - add describe backup command

- [#1654](https://github.com/xataio/frontend/pull/1654) [`d464342`](https://github.com/xataio/frontend/commit/d464342233f48dbffa8bbbf26237859615db8333) Thanks [@SferaDev](https://github.com/SferaDev)! - Improve auth profile commands

## 1.0.84

### Patch Changes

- [#1652](https://github.com/xataio/frontend/pull/1652) [`ac31345`](https://github.com/xataio/frontend/commit/ac31345d07ceef311162c084fbce2976e7397035) Thanks [@SferaDev](https://github.com/SferaDev)! - Remove deprecated XATA_API_REFRESH_TOKEN

## 1.0.83

### Patch Changes

- [#1649](https://github.com/xataio/frontend/pull/1649) [`2223c03`](https://github.com/xataio/frontend/commit/2223c037aadd51a9db4337d1c09b85bb21db39a0) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.8.6

## 1.0.82

### Patch Changes

- [#1613](https://github.com/xataio/frontend/pull/1613) [`60a1f98`](https://github.com/xataio/frontend/commit/60a1f98eaf93f28363f24347af52a9796b875556) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - optional latestRestore and earliestRestore fields on backups

- [#1619](https://github.com/xataio/frontend/pull/1619) [`9cf945b`](https://github.com/xataio/frontend/commit/9cf945bc27310c21abd60cb64ac283fbab791ba5) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - list and update backup configuration

## 1.0.81

### Patch Changes

- [#1596](https://github.com/xataio/frontend/pull/1596) [`6e32e6c`](https://github.com/xataio/frontend/commit/6e32e6c42945f2f88b43be8197be424771b8ca5f) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.8.4

## 1.0.80

### Patch Changes

- [#1591](https://github.com/xataio/frontend/pull/1591) [`9e6b2b3`](https://github.com/xataio/frontend/commit/9e6b2b3025043aea7162a19e5234949fbf6b4f8f) Thanks [@divyenduz](https://github.com/divyenduz)! - Fix the pgstream env vars

## 1.0.79

### Patch Changes

- [#1579](https://github.com/xataio/frontend/pull/1579) [`a668bee`](https://github.com/xataio/frontend/commit/a668beef2d2ab506d30c62c9dec2a98512037d10) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.8.3

## 1.0.78

### Patch Changes

- [#1568](https://github.com/xataio/frontend/pull/1568) [`2ab88cc`](https://github.com/xataio/frontend/commit/2ab88cc9028e3dbe295dc43ce2a6b28e76119dce) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - remove cluster enum type

## 1.0.77

### Patch Changes

- [#1550](https://github.com/xataio/frontend/pull/1550) [`6403d74`](https://github.com/xataio/frontend/commit/6403d747e26a6804dd9505e56cc432e1bc1bcdf3) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgroll to 0.14.3

## 1.0.76

### Patch Changes

- [#1527](https://github.com/xataio/frontend/pull/1527) [`6156f9b`](https://github.com/xataio/frontend/commit/6156f9b4081192545b326899d88628dcf1419080) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata onboard command

## 1.0.75

### Patch Changes

- [#1532](https://github.com/xataio/frontend/pull/1532) [`ec639fe`](https://github.com/xataio/frontend/commit/ec639feedd5513a9a027e23f2a6f21a21908a0f0) Thanks [@SferaDev](https://github.com/SferaDev)! - Add user information to auth status command

- [#1522](https://github.com/xataio/frontend/pull/1522) [`06a4df0`](https://github.com/xataio/frontend/commit/06a4df0c16a3fa7b4f1e7824cb50bde72dd0b9b6) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - use new list images endpoint

## 1.0.74

### Patch Changes

- [#1513](https://github.com/xataio/frontend/pull/1513) [`4e5e0d5`](https://github.com/xataio/frontend/commit/4e5e0d519d43b34479e1f8dbb50f976999b2a5d8) Thanks [@divyenduz](https://github.com/divyenduz)! - feat: xata ai sql

## 1.0.73

### Patch Changes

- [#1511](https://github.com/xataio/frontend/pull/1511) [`6b7abf2`](https://github.com/xataio/frontend/commit/6b7abf24ca4c86e48b2f772fce461e2f262a2552) Thanks [@SferaDev](https://github.com/SferaDev)! - Improve auth login --force logic

## 1.0.72

### Patch Changes

- [#1507](https://github.com/xataio/frontend/pull/1507) [`a03b3ec`](https://github.com/xataio/frontend/commit/a03b3ec1f517ed138c533f9938d8ad5196428962) Thanks [@divyenduz](https://github.com/divyenduz)! - Remove xata ai sql, blessed doesn't work well with bun compile

## 1.0.71

### Patch Changes

- [#1472](https://github.com/xataio/frontend/pull/1472) [`bef58e0`](https://github.com/xataio/frontend/commit/bef58e0291d50d2d73ee5171f1ebc98d31ea86d8) Thanks [@divyenduz](https://github.com/divyenduz)! - add ability to get org, project by their name

## 1.0.70

### Patch Changes

- [#935](https://github.com/xataio/frontend/pull/935) [`cefc03a`](https://github.com/xataio/frontend/commit/cefc03abc73c567df01aaa004d5fc6d683eac090) Thanks [@SferaDev](https://github.com/SferaDev)! - Move pgroll and pgstream to their own libraries

- Updated dependencies [[`cefc03a`](https://github.com/xataio/frontend/commit/cefc03abc73c567df01aaa004d5fc6d683eac090)]:
  - @xata.io/api@0.1.0
  - @xata.io/pgroll@0.8.0
  - @xata.io/pgstream@0.1.0
  - @xata.io/sql@0.1.2
  - @xata.io/config@0.0.0
  - @xata.io/pii@0.0.0

## 1.0.69

### Patch Changes

- [#1457](https://github.com/xataio/frontend/pull/1457) [`82054d5`](https://github.com/xataio/frontend/commit/82054d5e3b3d9ec592b0b28b99bd4a5c32da92fb) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - list backups command

## 1.0.68

### Patch Changes

- [#1453](https://github.com/xataio/frontend/pull/1453) [`b46d05a`](https://github.com/xataio/frontend/commit/b46d05a2c33491bedbcee455cf3a4370dcded3e5) Thanks [@divyenduz](https://github.com/divyenduz)! - rename url --type flags to primary, primary-or-replica, replica

## 1.0.67

### Patch Changes

- [#1446](https://github.com/xataio/frontend/pull/1446) [`07899c3`](https://github.com/xataio/frontend/commit/07899c3a5f65db91988ae4b3ca22148da01a5fbe) Thanks [@divyenduz](https://github.com/divyenduz)! - Add read only connection string endpoints

## 1.0.66

### Patch Changes

- [#1383](https://github.com/xataio/frontend/pull/1383) [`2e527dd`](https://github.com/xataio/frontend/commit/2e527dd61524fe85d00326575eda049cd8e64d77) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata clone stream command

## 1.0.65

### Patch Changes

- [#1368](https://github.com/xataio/frontend/pull/1368) [`1a460f3`](https://github.com/xataio/frontend/commit/1a460f3765b6a292647935e1cfa0be96c98e9fb4) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - Add mode to create branch

## 1.0.64

### Patch Changes

- [#1365](https://github.com/xataio/frontend/pull/1365) [`98cd6bf`](https://github.com/xataio/frontend/commit/98cd6bf83add688dd157bcecccaf2ed2c2dd4477) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.7.9

## 1.0.63

### Patch Changes

- [#1352](https://github.com/xataio/frontend/pull/1352) [`8ba47aa`](https://github.com/xataio/frontend/commit/8ba47aaacc66ea788ce70fbec526b55339ec5736) Thanks [@divyenduz](https://github.com/divyenduz)! - make migrations folder in xata roll url configurable

## 1.0.62

### Patch Changes

- [#1339](https://github.com/xataio/frontend/pull/1339) [`20f030e`](https://github.com/xataio/frontend/commit/20f030e04b9b17819f47c6600409c9eb8004364e) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - enable scale to zero

## 1.0.61

### Patch Changes

- [#1251](https://github.com/xataio/frontend/pull/1251) [`9123ec1`](https://github.com/xataio/frontend/commit/9123ec19e46855045836b98d098bc36c28fc47b1) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - add automatic scale to zero settings

- [#1309](https://github.com/xataio/frontend/pull/1309) [`e109bc5`](https://github.com/xataio/frontend/commit/e109bc5cf66acb60f72aa424f072abf4a60ff38d) Thanks [@divyenduz](https://github.com/divyenduz)! - make pgstream log-level configurable

## 1.0.60

### Patch Changes

- [#1241](https://github.com/xataio/frontend/pull/1241) [`15d2006`](https://github.com/xataio/frontend/commit/15d200600d612cc8082dc6b437dd3a4e7f51acc5) Thanks [@divyenduz](https://github.com/divyenduz)! - make get work with branch names

- [#1271](https://github.com/xataio/frontend/pull/1271) [`c344067`](https://github.com/xataio/frontend/commit/c344067741dc68e57d93201dfe028a4c44d83f92) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.7.7

## 1.0.59

### Patch Changes

- [#1242](https://github.com/xataio/frontend/pull/1242) [`143af2f`](https://github.com/xataio/frontend/commit/143af2f1ed0b2489a41def3483e08fa9dfac508e) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - enable hibernate setting for branch

## 1.0.58

### Patch Changes

- [#1194](https://github.com/xataio/frontend/pull/1194) [`73688e0`](https://github.com/xataio/frontend/commit/73688e0c26a446032b0650e1471533a562acb005) Thanks [@divyenduz](https://github.com/divyenduz)! - make xata upgrade upgrade pgroll and pgstream

## 1.0.57

### Patch Changes

- [#1191](https://github.com/xataio/frontend/pull/1191) [`a030382`](https://github.com/xataio/frontend/commit/a03038255cd098aa13e0459300f184460df5d2dd) Thanks [@divyenduz](https://github.com/divyenduz)! - add shortcuts description to clone

## 1.0.56

### Patch Changes

- [#1188](https://github.com/xataio/frontend/pull/1188) [`80aa67b`](https://github.com/xataio/frontend/commit/80aa67be677750abe8daa6b4952b7b5c423af3fe) Thanks [@divyenduz](https://github.com/divyenduz)! - clone start --role flag to chose postgres role for objects in target db

- [#1185](https://github.com/xataio/frontend/pull/1185) [`f0d3c9b`](https://github.com/xataio/frontend/commit/f0d3c9b1fd0eaa21c66c0cdb8364d074c32f28b6) Thanks [@divyenduz](https://github.com/divyenduz)! - make table and clone config order alphabetic

## 1.0.55

### Patch Changes

- [#1163](https://github.com/xataio/frontend/pull/1163) [`d269c05`](https://github.com/xataio/frontend/commit/d269c05462d49a7f847a75108fa4dfc6753782c5) Thanks [@divyenduz](https://github.com/divyenduz)! - fix release script and describe unit test

## 1.0.54

### Patch Changes

- [#1155](https://github.com/xataio/frontend/pull/1155) [`91069fc`](https://github.com/xataio/frontend/commit/91069fcbd005fcc2342b06dd8179a7965a9940fb) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.7.6

## 1.0.53

### Patch Changes

- [#1149](https://github.com/xataio/frontend/pull/1149) [`4c45125`](https://github.com/xataio/frontend/commit/4c4512551f82cada4a5ecd6b8ae5daf44c73ae9b) Thanks [@divyenduz](https://github.com/divyenduz)! - make selection of at least one schema, table, column when prompted mandatory

- Updated dependencies [[`374b27a`](https://github.com/xataio/frontend/commit/374b27aef25bd1ac879a593f9dc346c088f92a29)]:
  - @xata.io/sql@0.1.1
  - @xata.io/config@0.0.0
  - @xata.io/pii@0.0.0

## 1.0.52

### Patch Changes

- [#1141](https://github.com/xataio/frontend/pull/1141) [`092ae43`](https://github.com/xataio/frontend/commit/092ae43dc4aae26594d8e60567bfb056ee8e3ef3) Thanks [@divyenduz](https://github.com/divyenduz)! - pass --json to pgroll for roll pull

- [#1140](https://github.com/xataio/frontend/pull/1140) [`c04db05`](https://github.com/xataio/frontend/commit/c04db050ce27a632c4777f8d4066833d66747835) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - hide hibernate temporarily

## 1.0.51

### Patch Changes

- [#1111](https://github.com/xataio/frontend/pull/1111) [`ad4ddfb`](https://github.com/xataio/frontend/commit/ad4ddfbba6f10832eb6d2bddbb0752e94847521f) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - add ability to hibernate and wakeup branches

- [#1139](https://github.com/xataio/frontend/pull/1139) [`caaddae`](https://github.com/xataio/frontend/commit/caaddae35c6f31a75d6ab0f696eab58a673414bf) Thanks [@divyenduz](https://github.com/divyenduz)! - pass dotenv quiet option

## 1.0.50

### Patch Changes

- [#1129](https://github.com/xataio/frontend/pull/1129) [`50d65c1`](https://github.com/xataio/frontend/commit/50d65c1219ac6dfc28fd51cdbc0eedab2a404c23) Thanks [@tsg](https://github.com/tsg)! - update pgstream to version 0.7.5

## 1.0.49

### Patch Changes

- [#1118](https://github.com/xataio/frontend/pull/1118) [`8c51df2`](https://github.com/xataio/frontend/commit/8c51df24a0f1b35225198e3a75ed85251a3a4cd7) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - show branch statusType

## 1.0.48

### Patch Changes

- [#1116](https://github.com/xataio/frontend/pull/1116) [`e9111b4`](https://github.com/xataio/frontend/commit/e9111b43d395b688fb6376ff38976bdd0690c40d) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgroll to 0.14.1 and pgstream to 0.7.4

## 1.0.47

### Patch Changes

- [#1030](https://github.com/xataio/frontend/pull/1030) [`2aa7462`](https://github.com/xataio/frontend/commit/2aa74624297c568d7c9e5a5bf8b4a89dc3a530f2) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix problem with default values in inputs

## 1.0.46

### Patch Changes

- [#1028](https://github.com/xataio/frontend/pull/1028) [`8725313`](https://github.com/xataio/frontend/commit/872531352614d635b1a7d2b69d998c35bc6af7a9) Thanks [@divyenduz](https://github.com/divyenduz)! - make xata cli work with local api, auth setup

## 1.0.45

### Patch Changes

- [#1024](https://github.com/xataio/frontend/pull/1024) [`b229024`](https://github.com/xataio/frontend/commit/b2290242313bfe7808bd214aeaf0cef242301b28) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.7.2

## 1.0.44

### Patch Changes

- [#1012](https://github.com/xataio/frontend/pull/1012) [`f6548a9`](https://github.com/xataio/frontend/commit/f6548a93c103f824a86a68c8348167628919b1d6) Thanks [@divyenduz](https://github.com/divyenduz)! - make xata clone aware of pgroll and disable pgroll inferring

## 1.0.43

### Patch Changes

- [#1000](https://github.com/xataio/frontend/pull/1000) [`9dbf86f`](https://github.com/xataio/frontend/commit/9dbf86f4e72a8894f1b41cfe3569acf082bb64b6) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata roll update command

- [#999](https://github.com/xataio/frontend/pull/999) [`ca13a70`](https://github.com/xataio/frontend/commit/ca13a709d5344553fbda198e66f15b354c8521f4) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.7.0

## 1.0.42

### Patch Changes

- [#989](https://github.com/xataio/frontend/pull/989) [`e6db63d`](https://github.com/xataio/frontend/commit/e6db63d4ae447a707071cc71f22d98c2967085e6) Thanks [@divyenduz](https://github.com/divyenduz)! - make the downloaded paths correct for windows

## 1.0.41

### Patch Changes

- [#976](https://github.com/xataio/frontend/pull/976) [`7ddf304`](https://github.com/xataio/frontend/commit/7ddf3040ee9fb1862c6e3312847f5143916bb7b8) Thanks [@divyenduz](https://github.com/divyenduz)! - read existing clone config before suggesting prompts in clone config file

## 1.0.40

### Patch Changes

- [#964](https://github.com/xataio/frontend/pull/964) [`7f4e93b`](https://github.com/xataio/frontend/commit/7f4e93b21dc6fea01b7bc67f2bea300803072740) Thanks [@divyenduz](https://github.com/divyenduz)! - fix build secrets dev breaking prod

- [#966](https://github.com/xataio/frontend/pull/966) [`e0a2b0e`](https://github.com/xataio/frontend/commit/e0a2b0ec966ff36fcb432f48d75413ad36af50f0) Thanks [@divyenduz](https://github.com/divyenduz)! - inline auth secrets again

## 1.0.39

### Patch Changes

- [#962](https://github.com/xataio/frontend/pull/962) [`0ce124d`](https://github.com/xataio/frontend/commit/0ce124d8716d12bd61c553f0ddd75597e40d8950) Thanks [@divyenduz](https://github.com/divyenduz)! - bump pgstream to 0.6.6

- [#956](https://github.com/xataio/frontend/pull/956) [`b54288c`](https://github.com/xataio/frontend/commit/b54288ca9169885aabb9eb0eb4f9bcbedc0b2020) Thanks [@divyenduz](https://github.com/divyenduz)! - fix the active profile when CLI is configured with API key

- [#955](https://github.com/xataio/frontend/pull/955) [`6a78cf6`](https://github.com/xataio/frontend/commit/6a78cf6612d28d4062dcbcd2a8d13379b15c2990) Thanks [@divyenduz](https://github.com/divyenduz)! - xata roll url to get a search_path aware connection string

- [#948](https://github.com/xataio/frontend/pull/948) [`758394e`](https://github.com/xataio/frontend/commit/758394e3d98910430675f38ae282b0cfc6b6a5ce) Thanks [@divyenduz](https://github.com/divyenduz)! - move keycloak secrets to build time

- [#939](https://github.com/xataio/frontend/pull/939) [`8ca9e6f`](https://github.com/xataio/frontend/commit/8ca9e6fee918cdaa90b2b07276e6efb4a173746d) Thanks [@divyenduz](https://github.com/divyenduz)! - log pgstream version in xata version

- [#943](https://github.com/xataio/frontend/pull/943) [`be9c184`](https://github.com/xataio/frontend/commit/be9c18465ea23e5c34af036559809049e4e7bd8e) Thanks [@divyenduz](https://github.com/divyenduz)! - add more tests for branch command

- [#949](https://github.com/xataio/frontend/pull/949) [`ce9501d`](https://github.com/xataio/frontend/commit/ce9501d366acf9918aba43d174df99c86c9a5439) Thanks [@divyenduz](https://github.com/divyenduz)! - warn if CLI is partially configured

## 1.0.38

### Patch Changes

- [#915](https://github.com/xataio/frontend/pull/915) [`44c6b69`](https://github.com/xataio/frontend/commit/44c6b6985f8776dedd83d3d5d962dcf99097effd) Thanks [@SferaDev](https://github.com/SferaDev)! - Make API Keys work with the CLI

- [#924](https://github.com/xataio/frontend/pull/924) [`7af5177`](https://github.com/xataio/frontend/commit/7af51775bc4de7a97720da4a582e79ab8156dd1a) Thanks [@SferaDev](https://github.com/SferaDev)! - Don't force default env before checking `activeProfile`

- [#907](https://github.com/xataio/frontend/pull/907) [`f91f486`](https://github.com/xataio/frontend/commit/f91f486f23cf2495c1607f311fe1fa59dff81408) Thanks [@SferaDev](https://github.com/SferaDev)! - Add API Keys CLI commands

- [#921](https://github.com/xataio/frontend/pull/921) [`88bc58f`](https://github.com/xataio/frontend/commit/88bc58f398fe787ea3369545b8f79a768c68fbd2) Thanks [@divyenduz](https://github.com/divyenduz)! - refactor create branch, split child, root branch into separate contexts

- [#922](https://github.com/xataio/frontend/pull/922) [`5f78911`](https://github.com/xataio/frontend/commit/5f78911007e9ff03aabc2b3ff17b4e9ca3e26a24) Thanks [@divyenduz](https://github.com/divyenduz)! - fix types for optional flags and positional parameters

## 1.0.37

### Patch Changes

- [#901](https://github.com/xataio/frontend/pull/901) [`590f404`](https://github.com/xataio/frontend/commit/590f40480e88cbadcfb51a00cd94188fbd1eb091) Thanks [@divyenduz](https://github.com/divyenduz)! - fix flag handling in roll, clone commands

- [#870](https://github.com/xataio/frontend/pull/870) [`537ad24`](https://github.com/xataio/frontend/commit/537ad24d00cec954e562da857fe31ab25d1cd058) Thanks [@divyenduz](https://github.com/divyenduz)! - in xata init, create a database if it doesn't exist

- [#892](https://github.com/xataio/frontend/pull/892) [`13776ec`](https://github.com/xataio/frontend/commit/13776ecb18362499b567e8ca7aa5e533105bd5f5) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - use list instance type endpoint

- [#914](https://github.com/xataio/frontend/pull/914) [`3ee4765`](https://github.com/xataio/frontend/commit/3ee476522c30559d7315b2683e31252b7be3c50b) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix bug with login on a different profile

- [#917](https://github.com/xataio/frontend/pull/917) [`a1e0978`](https://github.com/xataio/frontend/commit/a1e0978216bb3f51dc7973d6114851725bf48a9f) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.6.5

## 1.0.36

### Patch Changes

- [#894](https://github.com/xataio/frontend/pull/894) [`11d5138`](https://github.com/xataio/frontend/commit/11d5138183d6e8895198c62282d2bac0af93842c) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata roll baseline command

- [#895](https://github.com/xataio/frontend/pull/895) [`e8eeb4f`](https://github.com/xataio/frontend/commit/e8eeb4f4eb807b6db82d4b126d444690af2f573c) Thanks [@divyenduz](https://github.com/divyenduz)! - use new statusType enum

- [#881](https://github.com/xataio/frontend/pull/881) [`a0a9da3`](https://github.com/xataio/frontend/commit/a0a9da3b28953003a1a4ab6c4b484e3baac99987) Thanks [@divyenduz](https://github.com/divyenduz)! - use postgres.js instead of pg

## 1.0.35

### Patch Changes

- [#857](https://github.com/xataio/frontend/pull/857) [`bf66bcf`](https://github.com/xataio/frontend/commit/bf66bcffe5d723348dba2953917e064e827e39c5) Thanks [@divyenduz](https://github.com/divyenduz)! - add ability to change branch config from CLI

- [#865](https://github.com/xataio/frontend/pull/865) [`84fb407`](https://github.com/xataio/frontend/commit/84fb4079fa9538e415288c82f2ac7502f710a769) Thanks [@xata-bot](https://github.com/xata-bot)! - update roll with new subcommands from latest

- [#873](https://github.com/xataio/frontend/pull/873) [`6d07028`](https://github.com/xataio/frontend/commit/6d07028103083b0f2f4df5d880a8d35be2f1771b) Thanks [@divyenduz](https://github.com/divyenduz)! - allow user to pick tables via --filter-tables in xata clone

- [#882](https://github.com/xataio/frontend/pull/882) [`756a136`](https://github.com/xataio/frontend/commit/756a1360f1836c7b44bcd5c044c125eb2c72d4e4) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.6.4

- Updated dependencies [[`3fc20dc`](https://github.com/xataio/frontend/commit/3fc20dc7a90929af9d7ed73c0a7068ffd7817412)]:
  - @xata.io/api@0.0.4

## 1.0.34

### Patch Changes

- [#852](https://github.com/xataio/frontend/pull/852) [`208efbe`](https://github.com/xataio/frontend/commit/208efbeb66f5b8472cc6ff15159814213d039e5b) Thanks [@richardgill](https://github.com/richardgill)! - Update pgstream version to v0.6.3

## 1.0.33

### Patch Changes

- [#833](https://github.com/xataio/frontend/pull/833) [`d1067c7`](https://github.com/xataio/frontend/commit/d1067c799e90d9a42501c0cf2dbb87926161a03a) Thanks [@divyenduz](https://github.com/divyenduz)! - unhide xata clone

## 1.0.32

### Patch Changes

- [#827](https://github.com/xataio/frontend/pull/827) [`1e5ad65`](https://github.com/xataio/frontend/commit/1e5ad65cec5c96ee3d8709db30c7d90650da1e17) Thanks [@divyenduz](https://github.com/divyenduz)! - update pgstream to 0.6.0

## 1.0.31

### Patch Changes

- [#809](https://github.com/xataio/frontend/pull/809) [`8b56062`](https://github.com/xataio/frontend/commit/8b56062007fb9c1c209d37f79b520aa35fd7aa92) Thanks [@SferaDev](https://github.com/SferaDev)! - Handle token refreshes from the API client

- Updated dependencies [[`8b56062`](https://github.com/xataio/frontend/commit/8b56062007fb9c1c209d37f79b520aa35fd7aa92)]:
  - @xata.io/api@0.0.3

## 1.0.30

### Patch Changes

- [#799](https://github.com/xataio/frontend/pull/799) [`a5b3d16`](https://github.com/xataio/frontend/commit/a5b3d1601d6bacc9ae647b9c45eb30dd33cbdd2b) Thanks [@divyenduz](https://github.com/divyenduz)! - Xata CLI, error messages, auto checkout of branch, improvements

- [#788](https://github.com/xataio/frontend/pull/788) [`5020699`](https://github.com/xataio/frontend/commit/502069914e272f54aff8aac13d621b4bb8b2687e) Thanks [@divyenduz](https://github.com/divyenduz)! - xata clone config to have a relaxed mode

- [#777](https://github.com/xataio/frontend/pull/777) [`4ad28c2`](https://github.com/xataio/frontend/commit/4ad28c2e6c545c6e1970ffe86987f878a3d082cb) Thanks [@divyenduz](https://github.com/divyenduz)! - fix checkout, delete to find current branch correctly

- [#808](https://github.com/xataio/frontend/pull/808) [`029b816`](https://github.com/xataio/frontend/commit/029b8168aa8143c949a43fed25c2c98cc7d1a869) Thanks [@divyenduz](https://github.com/divyenduz)! - refactor clone config structure

- [#803](https://github.com/xataio/frontend/pull/803) [`6b13cbf`](https://github.com/xataio/frontend/commit/6b13cbf0cf58f588eebccbeb7c35554a31aded2c) Thanks [@divyenduz](https://github.com/divyenduz)! - improve clone error message

- [#810](https://github.com/xataio/frontend/pull/810) [`a3c25d6`](https://github.com/xataio/frontend/commit/a3c25d647fcfdc81d28541da51ec83927834e545) Thanks [@divyenduz](https://github.com/divyenduz)! - replace instances with replicas

- [#747](https://github.com/xataio/frontend/pull/747) [`76eedbe`](https://github.com/xataio/frontend/commit/76eedbef9b575d7a23a8b6752b530ac1d38d8ea1) Thanks [@divyenduz](https://github.com/divyenduz)! - add .xata/config.ts to configure xata clone command

## 1.0.29

### Patch Changes

- Updated dependencies []:
  - @xata.io/api@0.0.2

## 1.0.28

### Patch Changes

- [#759](https://github.com/xataio/frontend/pull/759) [`deaf906`](https://github.com/xataio/frontend/commit/deaf9066dd853a2c7d520acc6397dc1242fc3a80) Thanks [@divyenduz](https://github.com/divyenduz)! - stream binary outputs and exit code to parent CLI

- [#758](https://github.com/xataio/frontend/pull/758) [`91eff6d`](https://github.com/xataio/frontend/commit/91eff6d7ddad534b886ca25ca5089b5014140ba7) Thanks [@divyenduz](https://github.com/divyenduz)! - don't make calls to org, project when unused

- [#770](https://github.com/xataio/frontend/pull/770) [`458b72f`](https://github.com/xataio/frontend/commit/458b72f44d719bed8555f6e9dcdd50d68a6e715c) Thanks [@divyenduz](https://github.com/divyenduz)! - ability to select instance type before branch creation

- [#745](https://github.com/xataio/frontend/pull/745) [`2d61465`](https://github.com/xataio/frontend/commit/2d6146568c13a8ccb19d0518b05d2095076fa905) Thanks [@divyenduz](https://github.com/divyenduz)! - Fix checkout to work with env auth, when current branch is broken.

- Updated dependencies [[`1f04f9f`](https://github.com/xataio/frontend/commit/1f04f9fefcc4d37492b029a0190358bb8447a95c)]:
  - @xata.io/api@0.0.1

## 1.0.27

### Patch Changes

- [#727](https://github.com/xataio/frontend/pull/727) [`de3c639`](https://github.com/xataio/frontend/commit/de3c6397f3d35bf23820ae631363458d9d069d95) Thanks [@divyenduz](https://github.com/divyenduz)! - refactor config schema to be parameterized

- [#697](https://github.com/xataio/frontend/pull/697) [`46fc5b1`](https://github.com/xataio/frontend/commit/46fc5b17cebabb2141eb96eea02045c47a291485) Thanks [@divyenduz](https://github.com/divyenduz)! - extract pii stuff into @xata.io/pii package and add more columns

- [#733](https://github.com/xataio/frontend/pull/733) [`4570897`](https://github.com/xataio/frontend/commit/4570897598fb55225129b9f0d18fb871c33cb3ac) Thanks [@divyenduz](https://github.com/divyenduz)! - don't check for migrations folder in pull command

- [#729](https://github.com/xataio/frontend/pull/729) [`02404cd`](https://github.com/xataio/frontend/commit/02404cd39689c015119cd2055aa1c441f679175b) Thanks [@divyenduz](https://github.com/divyenduz)! - Add more transforms and move getTransform to @xata.io/pii

## 1.0.26

### Patch Changes

- [#673](https://github.com/xataio/frontend/pull/673) [`63f0e3a`](https://github.com/xataio/frontend/commit/63f0e3ab17ad7e4f321602e790714541f5027c44) Thanks [@divyenduz](https://github.com/divyenduz)! - rename cli to xata-cli

## 1.0.25

### Patch Changes

- [#671](https://github.com/xataio/frontend/pull/671) [`9ac9e64`](https://github.com/xataio/frontend/commit/9ac9e648494502b6d4e84c5f5af3314cb643b89c) Thanks [@divyenduz](https://github.com/divyenduz)! - fix checkout, delete, current branch workflows

- [#651](https://github.com/xataio/frontend/pull/651) [`af40b8f`](https://github.com/xataio/frontend/commit/af40b8febc0cde808ad9a25c0e65048ed2e2fa65) Thanks [@divyenduz](https://github.com/divyenduz)! - add basic xata clone config

- [#648](https://github.com/xataio/frontend/pull/648) [`f9b5a9f`](https://github.com/xataio/frontend/commit/f9b5a9fd299e69d446ed2f637ea8c82232d48de2) Thanks [@divyenduz](https://github.com/divyenduz)! - add xata clone start command

## 1.0.24

### Patch Changes

- [#629](https://github.com/xataio/frontend/pull/629) [`22a2380`](https://github.com/xataio/frontend/commit/22a23806afcacf3572c7f78b5d7411be8d0526be) Thanks [@divyenduz](https://github.com/divyenduz)! - add region selector and remove storage selector from the CLI

- [#643](https://github.com/xataio/frontend/pull/643) [`b6b99b9`](https://github.com/xataio/frontend/commit/b6b99b99ca1b6c6553b8a6d546bd605d002b314a) Thanks [@divyenduz](https://github.com/divyenduz)! - show meaningful error message when private cluster is not reachable

## 1.0.23

### Patch Changes

- [#624](https://github.com/xataio/frontend/pull/624) [`f8a7115`](https://github.com/xataio/frontend/commit/f8a7115b11ef0b11f214b678b803d15af3df424a) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - send in the region

## 1.0.22

### Patch Changes

- [#602](https://github.com/xataio/frontend/pull/602) [`1b05974`](https://github.com/xataio/frontend/commit/1b059748ab08c10610d6484900572c39bdd3db66) Thanks [@divyenduz](https://github.com/divyenduz)! - add pgstream download command, generate script

- [#603](https://github.com/xataio/frontend/pull/603) [`ee82c36`](https://github.com/xataio/frontend/commit/ee82c3693d07e8497d42d64363b7e298dbe5d431) Thanks [@divyenduz](https://github.com/divyenduz)! - use common download utils with pgroll

- [#595](https://github.com/xataio/frontend/pull/595) [`4b3d3a8`](https://github.com/xataio/frontend/commit/4b3d3a8ad83666098238b18c9f719b692eaf51bc) Thanks [@divyenduz](https://github.com/divyenduz)! - hide pgroll download

## 1.0.21

### Patch Changes

- [#586](https://github.com/xataio/frontend/pull/586) [`ca4d8e2`](https://github.com/xataio/frontend/commit/ca4d8e2032675a44f672ef44086e830fbb2f5a12) Thanks [@divyenduz](https://github.com/divyenduz)! - bump pgroll version to 0.11.1

## 1.0.20

### Patch Changes

- [#584](https://github.com/xataio/frontend/pull/584) [`0516c4d`](https://github.com/xataio/frontend/commit/0516c4d9a5336444b34813155e82e2fd4678a3a9) Thanks [@divyenduz](https://github.com/divyenduz)! - fix xata upgrade command

## 1.0.19

### Patch Changes

- Updated dependencies [[`a4b162e`](https://github.com/xataio/frontend/commit/a4b162e7951b356151503e62ddacea0801f50206)]:
  - @xata.io/sql@0.1.0

## 1.0.18

### Patch Changes

- Updated dependencies [[`4288735`](https://github.com/xataio/frontend/commit/4288735393ee11e5578d77d0aa91892ea0abc5af)]:
  - @xata.io/sql@0.0.1

## 1.0.17

### Patch Changes

- Updated dependencies [[`37baefa`](https://github.com/xataio/frontend/commit/37baefa8cd9b23319df4f1e07d93288b8003c20c)]:
  - @xata.io/tsconfig@0.0.1
  - @xata.io/api@0.0.0
  - @xata.io/sql@0.0.0

## 1.0.16

### Patch Changes

- [#567](https://github.com/xataio/frontend/pull/567) [`babeb8f`](https://github.com/xataio/frontend/commit/babeb8f44745dbab868cca58e8fa98aac7940669) Thanks [@divyenduz](https://github.com/divyenduz)! - fix the prod api base url

## 1.0.15

### Patch Changes

- [#564](https://github.com/xataio/frontend/pull/564) [`2da4e1e`](https://github.com/xataio/frontend/commit/2da4e1e05782d79d17197eb208fc62b14fcb57e1) Thanks [@SferaDev](https://github.com/SferaDev)! - Make PROD the default environment

- [#560](https://github.com/xataio/frontend/pull/560) [`abddedc`](https://github.com/xataio/frontend/commit/abddedcbbe2dd2c60a3671bd80803fdd03a5b8c2) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - Move from auth.xata.tech to auth.xata.io

## 1.0.14

### Patch Changes

- [#557](https://github.com/xataio/frontend/pull/557) [`a678017`](https://github.com/xataio/frontend/commit/a678017c3514d07d52a6cbd8d11414c959b7f90d) Thanks [@divyenduz](https://github.com/divyenduz)! - update auth client name to xata

- [#515](https://github.com/xataio/frontend/pull/515) [`5545d61`](https://github.com/xataio/frontend/commit/5545d61f1da7ff124d99003f12eb52f01240108e) Thanks [@divyenduz](https://github.com/divyenduz)! - bugfixes in auth, tests

## 1.0.13

### Patch Changes

- [#503](https://github.com/xataio/frontend/pull/503) [`d333138`](https://github.com/xataio/frontend/commit/d3331380932f685faab55c4c3b0c5e78ccc6fa26) Thanks [@divyenduz](https://github.com/divyenduz)! - auto download pgroll binary on xata cli install and pin the pgroll CLI version

- [#501](https://github.com/xataio/frontend/pull/501) [`4bd72fc`](https://github.com/xataio/frontend/commit/4bd72fc028a1c310ca60d33c91a1d86e72692971) Thanks [@SferaDev](https://github.com/SferaDev)! - Update OAuth client id

- [#495](https://github.com/xataio/frontend/pull/495) [`59d128c`](https://github.com/xataio/frontend/commit/59d128cb81e9b0a9b734feb3b9ed24a854b6174b) Thanks [@divyenduz](https://github.com/divyenduz)! - fix missing branch 404

## 1.0.12

### Patch Changes

- [#491](https://github.com/xataio/frontend/pull/491) [`922f091`](https://github.com/xataio/frontend/commit/922f0910a9b100619e7ea8d5481e426455685a83) Thanks [@divyenduz](https://github.com/divyenduz)! - minor bugfixes across the CLI

## 1.0.11

### Patch Changes

- [#486](https://github.com/xataio/frontend/pull/486) [`ff26675`](https://github.com/xataio/frontend/commit/ff266757cb490330f451932a9732cce2c349f7eb) Thanks [@divyenduz](https://github.com/divyenduz)! - change connection string parsing

- [#487](https://github.com/xataio/frontend/pull/487) [`30df9f5`](https://github.com/xataio/frontend/commit/30df9f5dea24ba9485195aa4b709ec7d0313f754) Thanks [@divyenduz](https://github.com/divyenduz)! - update the s3 bucket to xata-cli-versions

## 1.0.10

### Patch Changes

- [#460](https://github.com/xataio/frontend/pull/460) [`44d7ac9`](https://github.com/xataio/frontend/commit/44d7ac97a95b426028eb5adf782a67749d14f5ee) Thanks [@divyenduz](https://github.com/divyenduz)! - separate branch config and project config file

- [#460](https://github.com/xataio/frontend/pull/460) [`44d7ac9`](https://github.com/xataio/frontend/commit/44d7ac97a95b426028eb5adf782a67749d14f5ee) Thanks [@divyenduz](https://github.com/divyenduz)! - add database switching flag

- [#479](https://github.com/xataio/frontend/pull/479) [`b0f5859`](https://github.com/xataio/frontend/commit/b0f5859b4150796d1759bf602101ebbefff97516) Thanks [@divyenduz](https://github.com/divyenduz)! - rename maki CLI to xata CLI, in all externally visible places

## 1.0.9

### Patch Changes

- [#426](https://github.com/xataio/frontend/pull/426) [`b215093`](https://github.com/xataio/frontend/commit/b215093461fab9a61f2669f5e05e90e7b00fcbd9) Thanks [@divyenduz](https://github.com/divyenduz)! - address branch by name in most commands

- [#425](https://github.com/xataio/frontend/pull/425) [`cfe1579`](https://github.com/xataio/frontend/commit/cfe157985a9fe6057e6a219b4046c73b2beecd1c) Thanks [@divyenduz](https://github.com/divyenduz)! - add prompts for branch config

- [#392](https://github.com/xataio/frontend/pull/392) [`ace8bba`](https://github.com/xataio/frontend/commit/ace8bba7c060decda0c5b0770654870a2e37f1b1) Thanks [@divyenduz](https://github.com/divyenduz)! - Unify CLI error handling in one place

- [#392](https://github.com/xataio/frontend/pull/392) [`ace8bba`](https://github.com/xataio/frontend/commit/ace8bba7c060decda0c5b0770654870a2e37f1b1) Thanks [@divyenduz](https://github.com/divyenduz)! - minor changes to make the actions workflow work

- [#422](https://github.com/xataio/frontend/pull/422) [`d7ea560`](https://github.com/xataio/frontend/commit/d7ea560749449a03debef305f6286cf2ed9bc205) Thanks [@divyenduz](https://github.com/divyenduz)! - make instance and storage required in project, branch creation workflows

- [#400](https://github.com/xataio/frontend/pull/400) [`ba6d7f8`](https://github.com/xataio/frontend/commit/ba6d7f800b91e2708b70dc49e122026163f9ad6f) Thanks [@divyenduz](https://github.com/divyenduz)! - Maki CLI: fix the org id prompt selection

## 1.0.8

### Patch Changes

- [#393](https://github.com/xataio/frontend/pull/393) [`d121bab`](https://github.com/xataio/frontend/commit/d121bab8f2488c5a4d4c1816fd7bc2a0ef22f264) Thanks [@SferaDev](https://github.com/SferaDev)! - Add staging CLI client

- [#332](https://github.com/xataio/frontend/pull/332) [`9061f98`](https://github.com/xataio/frontend/commit/9061f980218bd6e71d7879b1027bae632d6b2da8) Thanks [@rishimohan](https://github.com/rishimohan)! - [website] update : landing page copy, add new sections and refine UI

## 1.0.7

### Patch Changes

- [#371](https://github.com/xataio/frontend/pull/371) [`a246cef`](https://github.com/xataio/frontend/commit/a246cef40f738baa356a7135186a171c6f570bf6) Thanks [@divyenduz](https://github.com/divyenduz)! - don't include configuration with child branch

- [#377](https://github.com/xataio/frontend/pull/377) [`a1385a2`](https://github.com/xataio/frontend/commit/a1385a23fdb75b4649086893ab6357a8a3f5303f) Thanks [@divyenduz](https://github.com/divyenduz)! - add print abstraction, this allows adding --json to most commands

## 1.0.6

### Patch Changes

- [#363](https://github.com/xataio/frontend/pull/363) [`7ceb667`](https://github.com/xataio/frontend/commit/7ceb66792e97f111a22095b8f4d8a56a16b70daf) Thanks [@divyenduz](https://github.com/divyenduz)! - wrap enquirer so there are no prompts in ci

- [#360](https://github.com/xataio/frontend/pull/360) [`2c80888`](https://github.com/xataio/frontend/commit/2c8088851bb95cd14e07a84b9efb907554f7537a) Thanks [@divyenduz](https://github.com/divyenduz)! - - Implement maki auth access-token, maki auth refresh-token commands
  - MAKI_PGROLL_BINARY_VERSION to override pgroll version
  - .gitignore .maki/project.json and default to .maki/migratons for migrations

## 1.0.5

### Patch Changes

- [#351](https://github.com/xataio/frontend/pull/351) [`6bd2a77`](https://github.com/xataio/frontend/commit/6bd2a773f59aa6b1330ffe2988b31ed24d1c6fe9) Thanks [@divyenduz](https://github.com/divyenduz)! - maki roll migrate/pull default to a folder named migrations

- [#352](https://github.com/xataio/frontend/pull/352) [`1909cfc`](https://github.com/xataio/frontend/commit/1909cfc43ff84e6485453d02908147fe44baf9de) Thanks [@divyenduz](https://github.com/divyenduz)! - Maki CLI - delete branch with name

- [#349](https://github.com/xataio/frontend/pull/349) [`f5d6608`](https://github.com/xataio/frontend/commit/f5d6608ec862de2ba14d6d2a07f4e1b609458c62) Thanks [@divyenduz](https://github.com/divyenduz)! - branch checkout by name

## 1.0.4

### Patch Changes

- [#343](https://github.com/xataio/frontend/pull/343) [`e14ecd3`](https://github.com/xataio/frontend/commit/e14ecd35f15b3b6cc7edbabbfca5360b130497cc) Thanks [@divyenduz](https://github.com/divyenduz)! - add --json flag and maki branch get id (family of commands)

## 1.0.3

### Patch Changes

- [#330](https://github.com/xataio/frontend/pull/330) [`1886258`](https://github.com/xataio/frontend/commit/1886258f34927344c992c71fc0dbb7fc4e690a65) Thanks [@divyenduz](https://github.com/divyenduz)! - implement maki roll convert command

- [#331](https://github.com/xataio/frontend/pull/331) [`f17cb27`](https://github.com/xataio/frontend/commit/f17cb27f883c06c118c428ab66b86403c720190e) Thanks [@divyenduz](https://github.com/divyenduz)! - if a branch is available in .maki/project.json, use it in maki roll

## 1.0.2

### Patch Changes

- [#295](https://github.com/xataio/frontend/pull/295) [`98bf0dc`](https://github.com/xataio/frontend/commit/98bf0dc1deaf5225f62826c26eccf2aa06ed7f39) Thanks [@SferaDev](https://github.com/SferaDev)! - implement env var based CLI authentication

## 1.0.1

### Patch Changes

- [#296](https://github.com/xataio/frontend/pull/296) [`7b7d02d`](https://github.com/xataio/frontend/commit/7b7d02d71d529724ef1b5e5893c9b72e80f574f1) Thanks [@divyenduz](https://github.com/divyenduz)! - fix CI

- [#287](https://github.com/xataio/frontend/pull/287) [`b56e1aa`](https://github.com/xataio/frontend/commit/b56e1aa7ab65fc6c8508723413000070142360b1) Thanks [@divyenduz](https://github.com/divyenduz)! - improve on the release scripts

- [#267](https://github.com/xataio/frontend/pull/267) [`314c80d`](https://github.com/xataio/frontend/commit/314c80d1c672105addb8bea38ab23edc5b1ceea2) Thanks [@divyenduz](https://github.com/divyenduz)! - implement release scripts

- [#294](https://github.com/xataio/frontend/pull/294) [`5d8e3b6`](https://github.com/xataio/frontend/commit/5d8e3b6efb09d86812f81669abca7b7295dd1bb4) Thanks [@divyenduz](https://github.com/divyenduz)! - fix ci script

- [#293](https://github.com/xataio/frontend/pull/293) [`7b046d5`](https://github.com/xataio/frontend/commit/7b046d5d65a62a95bcf63e23fbd417acf394d1b5) Thanks [@divyenduz](https://github.com/divyenduz)! - update turbo to include channel

- [#292](https://github.com/xataio/frontend/pull/292) [`17d4609`](https://github.com/xataio/frontend/commit/17d46094274e178b2b0eb863ac09b1837475ec02) Thanks [@divyenduz](https://github.com/divyenduz)! - fix CI channel logic
