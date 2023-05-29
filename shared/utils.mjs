import _ from "lodash";
import assert from 'assert';

// Without this we cannot make partial updates to objects in the Task

function deepMerge(prevState, update) {

  if (prevState === undefined) {
    return update;
  }

  if (update === undefined) {
    return prevState;
  }

  let output = _.cloneDeep(prevState); // deep copy using lodash

  if (Array.isArray(output) && Array.isArray(update)) {
    output = new Array(Math.max(output.length, update.length));
    // For each index in the new array
    for (let i = 0; i < output.length; i++) {
      // If update has a value at this index, use it
      // Otherwise, use the value from output
      // Javascript creates sparse arrays in the diff, effectively replacing entries with undefined
      // JOSN convertes undefined to null, so we can't assume null is actaully intended to replace a value
      // We could convert arrays to hash for transport
      if (update[i] !== null && (typeof update[i] === "object" || Array.isArray(update[i]))) {
        output[i] = deepMerge(output[i], update[i]);
        //console.log("deepMerge: output[i] 1 ", output[i])
      } else if (update[i] !== undefined && update[i] !== null) {
        output[i] = update[i]
        //console.log("deepMerge: output[i] 2 ", output[i])
      } else {
        output[i] =  prevState[i]
        //console.log("deepMerge: output[i] 3 ", output[i])
      }
    }
  } else if (typeof output === "object" && output !== null) {
    // Could error if update is not an object
    for (const key of Object.keys(update)) {
      if (update[key] !== null && (typeof update[key] === "object" || Array.isArray(update[key]))) {
        output[key] = deepMerge(output[key], update[key]);
      } else {
        output[key] = update[key];
      }
    }
  } else {
    output = update;
  }

  return output;
}

function deepCompare(obj1, obj2, visitedObjects = new WeakSet()) {
  // Check if objects are cyclic
  if (visitedObjects.has(obj1) || visitedObjects.has(obj2)) {
    return true;
  }

  // Check if both inputs are objects
  if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
    visitedObjects.add(obj1);
    visitedObjects.add(obj2);

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    // Check if the inputs have different lengths
    if (keys1.length !== keys2.length) {
      return false;
    }

    // Recursively compare each property
    for (let key of keys1) {
      if (!keys2.includes(key) || !deepCompare(obj1[key], obj2[key], visitedObjects)) {
        return false;
      }
    }

    return true;
  } else {
    // If inputs are not objects (or are null), use strict equality check
    return obj1 === obj2;
  }
}


function getChanges(obj1, obj2) {
  const diff = {};

  // Helper function to check if a value is an object
  const isObject = (value) => typeof value === 'object' && value !== null;

  // Iterate over keys in obj1
  Object.keys(obj1).forEach(key => {
    //console.log("getChanges", key, obj1[key], obj2[key])
    if (!obj2.hasOwnProperty(key)) {
      // Missing key from obj2 
    } else if (isObject(obj1[key]) && isObject(obj2[key])) {
      const nestedDiff = getChanges(obj1[key], obj2[key]);
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff;
      }
    } else if (obj1[key] !== obj2[key]) {
      diff[key] = obj2[key];
    }
  });

  // Iterate over keys in obj2 not in obj1
  Object.keys(obj2).forEach(key => {
    if (!obj1.hasOwnProperty(key) && obj2[key] !== undefined) {
      diff[key] = obj2[key];
    }
  });

  //console.log("getChanges", obj1, obj2, diff)
  return diff;
}

function checkConflicts(obj1, obj2) {
  // Helper function to check if a value is an object
  const isObject = (value) => typeof value === 'object' && value !== null;

  let conflict = false;
  
  // Iterate over keys in obj1
  Object.keys(obj1).forEach(key => {
    if (obj2.hasOwnProperty(key)) {
      if (isObject(obj1[key]) && isObject(obj2[key])) {
        // Recursive check for nested objects
        if (checkConflicts(obj1[key], obj2[key])) {
          conflict = true;
        }
      } else if (obj1[key] !== obj2[key]) {
        // Conflict detected when values are different
        console.log("Conflict in merge: " + key + " " + JSON.stringify(obj1[key]) + " " + JSON.stringify(obj2[key]));
        conflict = true;
      }
    }
  });

  return conflict;
}

// This can return sparse arrays
function getObjectDifference(obj1, obj2) {

  if (_.isEqual(obj1, obj2)) {
    return Array.isArray(obj1) ? [] : {};
  }

  if (!_.isObject(obj1) || !_.isObject(obj2)) {
    return obj1;
  }

  let diffObj = Array.isArray(obj1) ? [] : {};

  _.each(obj1, (value, key) => {
    if (!_.has(obj2, key)) {
      diffObj[key] = value;
    } else {
      let diff = getObjectDifference(value, obj2[key]);
      if (diff !== null){
        diffObj[key] = diff
      }
    }
  });

  _.each(obj2, (value, key) => {
    // Note that is allows obj2 to replace the value of obj1 with null
    if (!_.has(obj1, key) || obj2[key] === null) {
      diffObj[key] = value;  // Maintain original value from obj2
    }
  });
  
  _.each(diffObj, (value, key) => {
    if (Array.isArray(value) && value.length === 1 && value[0] === null) {
      delete diffObj[key]
    } else if (Array.isArray(value) && value.length === 0) {
      delete diffObj[key]
    } else if (_.isObject(value) && _.isEmpty(value)) {
      //console.log("getObjectDifference", "delete", key, value);
      delete diffObj[key]
    } else if (value === undefined) {
      delete diffObj[key]
    }
  });

  return { ...diffObj }; // copy to avoid issues if the return value is modified
}

// Flatten hierarchical object and copy keys into children
function flattenObjects(objs) {
  const res = {};
  let parent2id = { root: "" };
  objs.forEach((obj) => {
    assert(obj.name, "Object missing name");
    assert(obj.parentType || obj.name === "root", "Object missing parentType");
    let id;
    if (obj.name === "root") {
      id = "root";
    } else {
      id = `${parent2id[obj.parentType]}.${obj.name}`;
    }
    assert(!res.id, "Object id already in use")
    obj["id"] = id;
    const parentId = parent2id[obj.parentType];
    const parent = res[parentId];
    obj["parentId"] =parentId;
    // Copy all the keys in obj[obj["parentId"]] that are not in obj[id] into obj[id]
    for (const key in parent) {
      if (!obj[key]) {
        obj[key] = parent[key];
      }
    }
    parent2id[obj.name] = id
    res[id] = obj;
  });
  return res;
}

export { deepMerge, deepCompare, getChanges, checkConflicts, getObjectDifference, flattenObjects };