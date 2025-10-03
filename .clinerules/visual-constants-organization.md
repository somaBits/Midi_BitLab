## Brief overview
All visual information including colors, dimensions, timing values, interaction thresholds, and other visual parameters should be centralized in the constants file with human-readable names and clear organization. This rule is project-specific for the MIDI Visualizer application and ensures maintainable, consistent visual styling across the entire codebase.

## Constants organization
- Group related constants under clear section comments (e.g., "Trigger Visual Constants", "Node Visual Constants")
- Use descriptive, unambiguous constant names that clearly indicate their purpose
- Include units or context in constant names when helpful (e.g., `CREATE_AREA_TOP_HEIGHT`, `TRIGGER_PORT_DIAMETER`)
- Colors should be defined as arrays for p5.js compatibility with descriptive names (e.g., `COLOR_TRIGGER_DOT`, `COLOR_PLAYHEAD`)

## Visual parameter consolidation
- Replace all hardcoded visual values in rendering code with named constants
- Import constants at the top of files that use them for clear dependency tracking
- Use constants for dimensions, weights, sizes, transparency values, timing intervals, and interaction thresholds
- Maintain consistency by referencing the same constant across multiple files when appropriate

## Human readability requirements
- Constant names should be immediately understandable without needing to check their values
- Group related constants together with section comments for easy navigation
- Include inline comments for constants that may need explanation of their purpose
- Use consistent naming conventions (SCREAMING_SNAKE_CASE for constants)

## Development workflow
- When adding new visual elements, immediately create constants rather than using hardcoded values
- When refactoring existing code, identify and extract hardcoded visual values to constants
- Update imports in all affected files when adding new constants
- Test visual consistency after consolidating constants to ensure no rendering changes occur

## MVC architecture compliance
- Keep all visual constants in the config layer (constants.js)
- Models should import constants for any dimensional calculations they perform
- Views should import constants for all rendering parameters
- Controllers should import constants for interaction thresholds and timing values
