/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { Mutex } from 'async-mutex';

const mutexes = new Map();
const releases = new Map();

export function getMutex(key) {
  if (!mutexes.has(key)) {
    mutexes.set(key, new Mutex());
  }
  return mutexes.get(key);
}

export async function taskLock(key, description = "") {
  if (key === undefined || key === null) {
    throw new Error("No key provided " + key);
  }
  const mutex = getMutex(key);
  console.log(`Requesting lock ${description} id: ${key}`);
  const release = await mutex.acquire();
  console.log(`Got lock ${description} id: ${key}`);
  releases.set(key, release); // Store the release function by key
  return release;
}

export function taskRelease(key, description = "") {
  const release = releases.get(key);
  if (release) {
    release();
    console.log(`Released lock ${description} id: ${key}`);
    releases.delete(key); // Remove the release function after releasing the lock
  } else {
    // We expect most tasks will not be locked so no need to warn
    //console.warn(`No lock found for key: ${key}`);
  }
}

export function lockOrError(key, description = "") {
  const mutex = getMutex(key);
  if (mutex.isLocked()) {
    throw new Error(`Cannot acquire lock for key: ${key}. Already locked. ${description}`);
  }
  const release = mutex.acquire();
  console.log(`Locked ${description} by id: ${key}`);
  return function releaseLock() {
    release.then((r) => r());
    console.log(`Released lock ${description} with id: ${key}`);
  };
}
