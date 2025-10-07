# MIDI Visualizer

A visual programming environment for MIDI Control Change messages with real-time recording, trigger-based sequencing, group playback, and project persistence.

## Getting Started

### Basic Workflow

**1. Record a MIDI CC**
- **Click empty space** → Starts recording
- **Send MIDI CC values** from your controller
- **Watch the waveform draw** in real-time as you move faders/knobs
- **Press Enter** or **click the recording track** → Creates node
- **Press ESC** → Cancels recording

**2. Playback**
- **Click a node** → Starts playback (red playhead sweeps across)
- **Click again** → Restarts from beginning
- **Spacebar** → Stops all playback

**3. Add Triggers**
- **Click node's top edge** → Creates VTrigger (vertical line)
- **Click node's right edge** → Creates HTrigger (horizontal line)
- **Drag trigger lines** → Adjust position/threshold
- **Right-click trigger** → Shows delete icon

**4. Connect Triggers**
- **Click a trigger port** (small dot)
- **Drag to another port** (yellow preview cable appears)
- **Release on target port** → Creates connection (white cable)
- **Hover over cable** → Shows delete icon at midpoint
- **Click delete icon** → Removes connection

**5. Group Nodes**
- **Hold Shift + drag node near another** → Blue outline preview appears
- **Release** → Nodes snap together and form group (white dashed border)
- **Click any grouped node** → All play together (blue group playhead)
- **Drag grouped node** → Entire group moves together
- **Shift+drag grouped node** → Moves individually (auto-ungroups if >30px away)

**6. Save & Load Projects**
- **Open sidebar** → Click hamburger menu (☰) in top-left
- **Edit project name** → Click pencil icon (✏️) next to name
- **Click green Save button** → Downloads JSON file with timestamp
- **Click blue Load button** → Opens file dialog to restore project
- **All state preserved** → Nodes, triggers, connections, groups fully restored

## All Interactions

### Mouse Actions
| Action | Result |
|--------|--------|
| Click empty space | Start recording |
| Click node | Start/restart playback |
| Click grouped nodes | Synchronized group playback |
| Drag node | Move node |
| Alt+drag node | Duplicate node (+12px offset) |
| Shift+click node top edge | Split node at position |
| Click node top edge | Create VTrigger |
| Click node right edge | Create HTrigger |
| Drag trigger | Adjust position |
| Click trigger port | Start cable drag |
| Drag cable to port | Create connection |
| Hover cable | Show delete icon |
| Right-click node | Show delete overlay |
| Right-click trigger | Show delete icon |
| Hold Shift while dragging | Group preview / individual movement |
| Click sidebar Save button | Download project as JSON |
| Click sidebar Load button | Open file dialog to restore project |
| Click project name edit icon | Edit project name inline |

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| **Enter** | Commit recording |
| **ESC** | Cancel recording |
| **Spacebar** | Stop all playback |
| **Shift** | Enable grouping mode during drag |
| **Alt** | Enable duplication mode during drag |

### Visual Feedback
- **Red playhead** → Individual node playback
- **Blue playhead** → Group synchronized playback
- **White dashed border** → Nodes are grouped
- **Blue dashed border** → Group preview during Shift+drag
- **Yellow cable** → Connection drag preview
- **White cable** → Completed connection
- **Cursor changes** → `ew-resize` (horizontal trigger), `ns-resize` (vertical trigger), `copy` (Alt+drag)

## Pro Tips

- **Multi-track recording**: Send multiple CCs simultaneously → Creates grouped nodes automatically
- **Trigger sequencing**: Connect output ports to input ports → Chain playback across nodes
- **Group playback from trigger**: Connect cable to VTrigger input → Group plays from that position
- **Delete persistence**: Right-click node → Overlay stays until you release inside node or on delete icon

## Technical Details

Built with clean MVC architecture using P5.js for rendering, featuring:
- Event-driven trigger propagation system
- Real-time MIDI recording at 100 pixels/second
- Group management with synchronized playback coordination
- Universal port connection system with directional validation

---

**Project Status**: 71% complete (15/21 planned components implemented)
