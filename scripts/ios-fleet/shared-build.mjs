// Pure build planner.  No network, uploads or release state changes.
// One shared merge-timestamp build number per app across iOS and macOS
// (owner, Oct 29 2026):  build = max(S, M + 1) as a plain integer, where
// S is the committer date of the commit being built (HEAD, the squash-merge
// commit on main) in America/Chicago as YYYYMMDDHHMM (12 digits) and M is
// the highest first numeric component among EVERY build of the app on BOTH
// platforms (expired included, all version trains, old timestamp-style
// builds included) plus every extra floor.  No floor:  a rebuild of the
// same commit still goes up, because M then holds the previous ship.  One
// ceiling:  the planned build is a 12-digit merge stamp, so a max(S, M + 1)
// past 12 digits throws instead of planning a build the ship would reject.
export function nextSharedBuild({iosBuilds, macBuilds, extraFloors = [], complete, mergeStamp}) {
  if (complete !== true || !Array.isArray(iosBuilds) || !Array.isArray(macBuilds)) {
    throw new Error('complete build inventory required');
  }
  if (typeof mergeStamp !== 'string' || !/^[1-9][0-9]{11}$/.test(mergeStamp)) {
    throw new Error('malformed merge stamp');
  }
  if (!Array.isArray(extraFloors)) throw new Error('malformed build inventory');
  const floors = [];
  for (const floor of extraFloors) {
    if (typeof floor === 'number') {
      if (!Number.isSafeInteger(floor) || floor < 0) throw new Error('malformed build inventory');
      floors.push(BigInt(floor));
    } else if (typeof floor === 'string' && /^[0-9]+$/.test(floor)) {
      floors.push(BigInt(floor));
    } else {
      throw new Error('malformed build inventory');
    }
  }
  // Validate everything before computing; malformed evidence is never ignored.
  const re = /^[0-9]+(\.[0-9]+){0,2}$/;
  for (const value of [...iosBuilds, ...macBuilds]) {
    if (typeof value !== 'string' || !re.test(value)) throw new Error('malformed build inventory');
  }
  const stamp = BigInt(mergeStamp);
  let highest = null;
  for (const value of [...iosBuilds, ...macBuilds]) {
    const first = BigInt(value.split('.')[0]);
    if (highest === null || first > highest) highest = first;
  }
  for (const floor of floors) {
    if (highest === null || floor > highest) highest = floor;
  }
  const next = highest === null ? stamp : (highest + 1n > stamp ? highest + 1n : stamp);
  if (next > 999999999999n) throw new Error('planned build exceeds 12 digits');
  return {build: String(next)};
}
