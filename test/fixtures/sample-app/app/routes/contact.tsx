import { Form } from 'react-router';

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const email = formData.get('email');
  const message = formData.get('message');
  // Note: 'name' is in form but not read here (warning)
  // Note: 'subject' is read here but not in form (error)
  const subject = formData.get('subject');

  return { success: true, email, message, subject };
}

export default function Contact() {
  return (
    <div>
      <h1>Contact Us</h1>
      <Form method="post">
        <input name="name" placeholder="Your name" />
        <input name="email" placeholder="Your email" />
        <textarea name="message" placeholder="Your message" />
        <button type="submit">Send</button>
      </Form>
    </div>
  );
}
