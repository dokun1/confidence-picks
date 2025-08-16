<script>
  import GroupCard from '../designsystem/components/GroupCard.svelte';

  // Mock group data
  const ownerGroup = {
    id: '1',
    name: 'Fantasy Friends',
    identifier: 'fantasy-friends-2024',
    description: 'Our yearly fantasy football confidence pool with college friends. Winner takes all!',
    memberCount: 8,
    isOwner: true,
    createdAt: '2024-08-01T10:00:00Z'
  };

  const memberGroup = {
    id: '2',
    name: 'Office Championship',
    identifier: 'office-champs',
    description: 'Company-wide confidence picks league. May the best predictor win!',
    memberCount: 24,
    isOwner: false,
    createdAt: '2024-07-15T14:30:00Z'
  };

  const smallGroup = {
    id: '3',
    name: 'Family Pool',
    identifier: 'fam-pool',
    description: 'Just the family competing for bragging rights.',
    memberCount: 4,
    isOwner: true,
    createdAt: '2024-08-10T09:15:00Z'
  };

  function handleViewGroup(group) {
    console.log('View group:', group);
  }

  function handleEditGroup(group) {
    console.log('Edit group:', group);
  }

  function handleJoinGroup(group) {
    console.log('Join group:', group);
  }

  function handleLeaveGroup(group) {
    console.log('Leave group:', group);
  }
</script>

<div class="space-y-lg">
  <div>
    <h2 class="text-2xl font-heading font-bold text-[var(--color-text-primary)] mb-md">
      Group Card
    </h2>
    <p class="text-[var(--color-text-secondary)] mb-lg">
      Display group information with member counts, owner/member badges, and contextual actions.
    </p>
  </div>

  <!-- Owner View -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Owner View
    </h3>
    <p class="text-[var(--color-text-secondary)] mb-md">
      When the current user owns the group, they see edit and view actions.
    </p>
    <div class="max-w-md">
      <GroupCard 
        group={ownerGroup}
        onView={handleViewGroup}
        onEdit={handleEditGroup}
      />
    </div>
  </div>

  <!-- Member View -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Member View
    </h3>
    <p class="text-[var(--color-text-secondary)] mb-md">
      When the current user is a member, they see view and leave actions.
    </p>
    <div class="max-w-md">
      <GroupCard 
        group={memberGroup}
        onView={handleViewGroup}
        onLeave={handleLeaveGroup}
      />
    </div>
  </div>

  <!-- Small Group -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Small Group
    </h3>
    <p class="text-[var(--color-text-secondary)] mb-md">
      Groups adapt to different member counts and description lengths.
    </p>
    <div class="max-w-md">
      <GroupCard 
        group={smallGroup}
        onView={handleViewGroup}
        onEdit={handleEditGroup}
      />
    </div>
  </div>

  <!-- Responsive Grid -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Responsive Grid
    </h3>
    <p class="text-[var(--color-text-secondary)] mb-md">
      Multiple cards in a responsive grid layout.
    </p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
      <GroupCard 
        group={ownerGroup}
        onView={handleViewGroup}
        onEdit={handleEditGroup}
      />
      <GroupCard 
        group={memberGroup}
        onView={handleViewGroup}
        onLeave={handleLeaveGroup}
      />
      <GroupCard 
        group={smallGroup}
        onView={handleViewGroup}
        onEdit={handleEditGroup}
      />
    </div>
  </div>
</div>
