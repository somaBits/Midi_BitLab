## Brief overview
Guidelines for using the monolithic script as the definitive source of truth for all user interactions, visual feedback, and UX patterns in the MIDI Visualizer MVC rewrite. These rules ensure perfect parity between the clean architecture and the original user experience.

## UX reference standards
- Always reference `monolithic_script.js` as the authoritative source for interaction behavior
- Maintain identical cursor changes, hover states, and visual feedback patterns
- Preserve exact mouse event priorities and interaction sequences from the original
- Use the same threshold values, timing constants, and visual parameters
- Match the original's visual styling, colors, and animation behaviors precisely

## Interaction parity requirements
- Test all new MVC implementations against the monolithic script behavior
- Verify that cursor management matches original patterns (ew-resize, ns-resize, etc.)
- Ensure drag operations feel identical to the monolithic version
- Maintain the same edge area detection zones and creation workflows
- Preserve original click priorities and event handling sequences

## Code reference methodology
- Study monolithic script patterns before implementing MVC equivalents
- Extract constants and thresholds directly from the original implementation
- Use the same variable names and logic patterns where architecturally appropriate
- Reference original console log messages for verification and debugging
- Maintain identical feature completeness while improving code organization

## Architecture translation principles
- Translate monolithic functions into proper MVC separation without changing behavior
- Keep the same public API surface and interaction patterns
- Preserve all original keyboard shortcuts, mouse interactions, and visual cues
- Maintain the same performance characteristics and responsiveness
- Use the monolithic script as the acceptance criteria for each feature implementation

## Exclusion guidelines
- Signal processing and oscilloscope features may be excluded as specified
- Core interaction patterns (drag, click, hover, creation) must match exactly
- Visual rendering and user feedback systems require perfect parity
- MIDI handling and recording workflows should mirror the original completely
