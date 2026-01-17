import { Form } from 'react-router';

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rating = formData.get('rating');
  const comment = formData.get('comment');

  return { success: true, rating, comment };
}

export default function Feedback() {
  return (
    <div>
      <h1>Feedback</h1>
      <Form method="post">
        <input name="rating" type="number" min="1" max="5" />
        <textarea name="comment" placeholder="Your feedback" />
        <button type="submit">Submit</button>
      </Form>
    </div>
  );
}
