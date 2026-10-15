// A stable, non-identifying key for the signed-in user, so a shared browser keeps each user's stored Beacon
// choices apart without the id itself landing in storage. djb2 over the id, base36. Every product hashed its
// id this way in its own mount; this is the one copy (decision #167). Omit the user id at the mount to key
// per browser instead.
export function userKeyOf(id: string): string {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
