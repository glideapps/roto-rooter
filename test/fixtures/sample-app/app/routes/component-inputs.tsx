// Test fixture for component-wrapped form inputs
// These are common patterns from UI libraries like Radix, Chakra, MUI, etc.

import { Form } from 'react-router';

// Simulating imports from a UI library
// These components would render native HTML form elements with the name prop
interface InputProps {
  name: string;
  label?: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}

// Component wrappers that render native inputs
const TextField = (_props: InputProps) => null;
const TextArea = (_props: InputProps) => null;
const NumberInput = (_props: InputProps) => null;
const EmailInput = (_props: InputProps) => null;
const RadioGroup = (_props: InputProps) => null;
const SelectField = (_props: InputProps) => null;
const DatePicker = (_props: InputProps) => null;

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
  const email = formData.get('email');
  const bio = formData.get('bio');
  const age = formData.get('age');
  const role = formData.get('role');
  const startDate = formData.get('startDate');
  const notifications = formData.get('notifications');

  return {
    success: true,
    data: {
      firstName,
      lastName,
      email,
      bio,
      age,
      role,
      startDate,
      notifications,
    },
  };
}

export default function ComponentInputs() {
  return (
    <div>
      <h1>Profile Edit</h1>
      <Form method="post">
        {/* Common UI library input components */}
        <TextField name="firstName" label="First Name" required />
        <TextField name="lastName" label="Last Name" required />
        <EmailInput name="email" label="Email Address" />
        <TextArea name="bio" label="Biography" />
        <NumberInput name="age" label="Age" />
        <SelectField name="role" label="Role" />
        <DatePicker name="startDate" label="Start Date" />
        <RadioGroup name="notifications" label="Notifications" />
        <button type="submit">Save Profile</button>
      </Form>
    </div>
  );
}
