import { useNavigate } from 'react-router-dom';
import { Button } from '../designsystem/components/Button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className='p-lg'>
      <h1 className='text-2xl font-bold'>Page not found</h1>
      <section className='mt-md space-y-md text-base text-gray-600'>
        <p>
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
          Check the address, or head back to safe ground.
        </p>
        <Button variant='primary' onClick={() => navigate('/')}>
          Go home
        </Button>
      </section>
    </div>
  );
}
