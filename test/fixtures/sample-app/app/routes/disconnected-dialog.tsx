import { useState } from 'react';

/**
 * Test fixtures for disconnected interactivity patterns.
 * These patterns should be flagged by the interactivity check.
 */

/**
 * Pattern 1: Dialog with form inputs where Save button only closes dialog
 * SHOULD BE FLAGGED: error
 */
export function BrokenEditDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input type="text" defaultValue="John Doe" />
          <input type="email" defaultValue="john@example.com" />
          <textarea defaultValue="Notes here" />
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 2: Delete confirmation dialog where Delete button only closes
 * SHOULD BE FLAGGED: error (even without inputs - it's a confirmation that doesn't act)
 */
export function BrokenDeleteDialog() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Employee</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this employee? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button mood="destructive" onClick={() => setDeleteOpen(false)}>
            Delete Employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 3: Stub handler in dialog
 * SHOULD BE FLAGGED: warning
 */
export function StubHandlerDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input type="text" placeholder="Item name" />
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              console.log('Add clicked');
            }}
          >
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 4: Update button that only closes
 * SHOULD BE FLAGGED: error
 */
export function BrokenUpdateDialog() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <select name="theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={() => setSettingsOpen(false)}>
            Update Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 5: Standalone button with stub function reference
 * SHOULD BE FLAGGED: warning
 */
export function StandaloneStubButton() {
  const handleAddEmployee = () => {
    console.log('Add employee clicked');
  };

  return (
    <div>
      <h1>Employees</h1>
      <ToolbarButton onClick={handleAddEmployee}>Add Employee</ToolbarButton>
    </div>
  );
}

// Dummy component stubs for the fixture to parse correctly
function Dialog(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return <div>{props.children}</div>;
}
function DialogContent(props: { children: React.ReactNode }) {
  return <div>{props.children}</div>;
}
function DialogHeader(props: { children: React.ReactNode }) {
  return <div>{props.children}</div>;
}
function DialogTitle(props: { children: React.ReactNode }) {
  return <div>{props.children}</div>;
}
function DialogDescription(props: { children: React.ReactNode }) {
  return <div>{props.children}</div>;
}
function DialogBody(props: { children: React.ReactNode }) {
  return <div>{props.children}</div>;
}
function DialogFooter(props: { children: React.ReactNode }) {
  return <div>{props.children}</div>;
}
function Button(props: {
  onClick?: () => void;
  children: React.ReactNode;
  mood?: string;
}) {
  return <button onClick={props.onClick}>{props.children}</button>;
}
function ToolbarButton(props: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return <button onClick={props.onClick}>{props.children}</button>;
}
