import { useState } from 'react';
import { Form, useFetcher } from 'react-router';

/**
 * Test fixtures for PROPERLY connected interactivity patterns.
 * These patterns should NOT be flagged by the interactivity check.
 */

/**
 * Pattern 1: Dialog with React Router Form - CORRECT
 * SHOULD NOT BE FLAGGED
 */
export function WorkingFormDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <Form method="post">
          <input name="name" defaultValue="John Doe" />
          <input name="email" defaultValue="john@example.com" />
          <Button type="submit">Save Changes</Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 2: Dialog using useFetcher.submit() - CORRECT
 * SHOULD NOT BE FLAGGED
 */
export function WorkingFetcherDialog() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();

  const handleSave = () => {
    fetcher.submit({ name: 'John' }, { method: 'post' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input type="text" defaultValue="John Doe" />
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 3: Cancel button that closes dialog - CORRECT behavior
 * SHOULD NOT BE FLAGGED (Cancel buttons SHOULD close the dialog)
 */
export function CancelButtonIsOk() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 4: Info-only dialog with OK button - CORRECT
 * SHOULD NOT BE FLAGGED (no inputs, just informational)
 */
export function InfoDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Information</DialogTitle>
          <DialogDescription>
            This is an informational message. Click OK to dismiss.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pattern 5: Delete confirmation using Form - CORRECT
 * SHOULD NOT BE FLAGGED
 */
export function WorkingDeleteDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Employee</DialogTitle>
        </DialogHeader>
        <Form method="delete">
          <input type="hidden" name="intent" value="delete" />
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit">Delete Employee</Button>
        </Form>
      </DialogContent>
    </Dialog>
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
  type?: string;
}) {
  return <button onClick={props.onClick}>{props.children}</button>;
}
