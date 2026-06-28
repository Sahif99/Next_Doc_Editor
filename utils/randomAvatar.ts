export function randomAvatar(
  seed: string
) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
    seed
  )}`;
}