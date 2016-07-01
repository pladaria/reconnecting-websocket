# Reconnecting WebSocket

WARNING! Work in progress

## Problems to solve:

- Multiplatform (allow usage in Web, cli, React Native...)
- Reassign event listeners when a new WebSocket instance is created
- Keep same WebSocket interface
- Automatic reconnection using rfc6455 guidelines
- Handle connection timeouts
- Dependency free (do not depend on window, dom or any event listener library)
- Full test coverage

## Future improvements

- autoOpen option
