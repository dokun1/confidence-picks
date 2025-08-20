<script>
  export let name = '';
  export let email = '';
  export let pictureUrl = null;
  export let size = 32; // px
  export let className = '';
  export let rounded = 'full'; // full or base

  let sources = [];
  let index = 0;
  let failed = false;

  $: initials = (name || email || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0,2)
    .map(p=>p[0].toUpperCase())
    .join('');

  $: if (pictureUrl) {
    const base = pictureUrl;
    const variants = new Set();
    variants.add(base);
    if (/=s\d+-c$/.test(base)) {
      variants.add(base.replace(/=s\d+-c$/, '=s64-c'));
      variants.add(base.replace(/=s\d+-c$/, '=s128-c'));
      variants.add(base.replace(/=s\d+-c$/, ''));
    } else if (!/[?&]sz=/.test(base)) {
      variants.add(base + (base.includes('?') ? '&' : '?') + 'sz=128');
    }
    sources = Array.from(variants);
    index = 0;
    failed = false;
  } else {
    sources = [];
    failed = true;
  }

  const dimensionClass = `w-[${size}px] h-[${size}px]`;
</script>

{#if !failed && sources.length}
  <img
    src={sources[index]}
    alt={name || email}
    class={`object-cover ${dimensionClass} rounded-${rounded} border border-primary-100 dark:border-primary-800 ${className}`}
    referrerpolicy="no-referrer"
    crossorigin="anonymous"
    on:error={() => {
      if (index < sources.length - 1) index += 1; else failed = true;
    }}
  />
{:else}
  <div class={`flex items-center justify-center bg-primary-500 text-neutral-0 font-medium ${dimensionClass} rounded-${rounded} ${className}`}>
    {initials}
  </div>
{/if}
