# ios-safari-check

Runs a scripted flow in mobile Safari on the iOS Simulator, on a GitHub Actions macOS runner (Appium + XCUITest).

Run it from the Actions tab (or `gh workflow run ios-safari.yml -f url=<page> -f flow=<name>`). Screenshots, the Appium log and `report.txt` are uploaded as the `ios-safari` artifact.

Flows live in `flows/`.
