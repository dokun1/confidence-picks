<script>
  import Avatar from '../designsystem/components/Avatar.svelte';
</script>

<div class="p-lg space-y-lg">
  <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">Avatar Size Test</h2>
  
  <div class="space-y-md">
    <div class="p-md bg-neutral-0 dark:bg-secondary-800 rounded border">
      <h3 class="text-lg font-semibold mb-md">Default Size (now 32px)</h3>
      <div class="flex items-center gap-sm">
        <Avatar name="John Doe" />
        <span class="text-sm">Default Avatar (32px)</span>
      </div>
    </div>

    <div class="p-md bg-neutral-0 dark:bg-secondary-800 rounded border">
      <h3 class="text-lg font-semibold mb-md">Previous Size (40px for comparison)</h3>
      <div class="flex items-center gap-sm">
        <Avatar name="John Doe" size={40} />
        <span class="text-sm">Previous Size (40px)</span>
      </div>
    </div>

    <div class="p-md bg-neutral-0 dark:bg-secondary-800 rounded border">
      <h3 class="text-lg font-semibold mb-md">Small Size (24px)</h3>
      <div class="flex items-center gap-sm">
        <Avatar name="John Doe" size={24} />
        <span class="text-sm">Small Size (24px)</span>
      </div>
    </div>

    <div class="p-md bg-neutral-0 dark:bg-secondary-800 rounded border">
      <h3 class="text-lg font-semibold mb-md">Current Recent Activity Size (32px)</h3>
      <div class="flex items-center gap-sm">
        <Avatar name="Jane Smith" size={32} className="text-xs" />
        <span class="text-sm">Recent Activity Size (32px)</span>
      </div>
    </div>

    <div class="p-md bg-neutral-0 dark:bg-secondary-800 rounded border">
      <h3 class="text-lg font-semibold mb-md">Group Display</h3>
      <div class="space-y-sm">
        <div class="flex items-center gap-sm p-sm bg-secondary-50 dark:bg-secondary-700 rounded">
          <Avatar name="Member One" size={32} />
          <div>
            <div class="font-medium text-[var(--color-text-primary)]">Member One</div>
            <div class="text-sm text-[var(--color-text-secondary)]">member@example.com</div>
          </div>
        </div>
        <div class="flex items-center gap-sm p-sm bg-secondary-50 dark:bg-secondary-700 rounded">
          <Avatar name="Member Two" size={32} />
          <div>
            <div class="font-medium text-[var(--color-text-primary)]">Member Two</div>
            <div class="text-sm text-[var(--color-text-secondary)]">member2@example.com</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>