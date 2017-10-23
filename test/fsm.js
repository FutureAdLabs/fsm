/*global describe, it */

import assert from "assert";
import * as erx from "@adludio/erx";

import FSM from "../src";

function asap(fn) {
  setTimeout(fn, 1);
}

function assertSeq(c, expected, done) {
  const acc = [];
  c.subscribe((v) => acc.push(v), null, () => {
    assert.deepEqual(acc, expected);
    done();
  });
}

function turnstile(cb) {
  const fsm = new FSM({
    "locked": {
      "coin": () => "open"
    },
    "open": {
      "push": () => "locked",
      "coin": () => "open"
    }
  }, {
    "locked": {
      "open": () => cb("locked->open"),
      "locked": () => cb("open->locked")
    },
    "open": {
      "locked": () => cb("open->locked"),
      "open": () => cb("open->open")
    }
  });
  fsm.goTo("locked");
  return fsm;
}

describe("finite state machine", () => {
  it("the turnstile machine behaves as expected", (done) => {
    const changes = [];
    const m = turnstile((i) => {
      changes.push(i);
      return true;
    });
    asap(() => {
      m.send("push");
      asap(() => {
        m.send("coin");
        asap(() => {
          m.send("coin");
          asap(() => {
            m.send("push");
          });
        });
      });
    });
    assertSeq(m.take(3), ["open", "open", "locked"], () => {
      assert.deepEqual(changes, ["locked->open", "open->open", "open->locked"]);
      done();
    });
  });

  it("whileIn() propagates values only until FSM state changes", (done) => {
    const m = turnstile((i) => true);
    const c = erx.bus();
    setTimeout(() => c.push(1), 5);
    setTimeout(() => { c.push(2); m.send("coin"); }, 10);
    setTimeout(() => { c.push(3); c.close(); }, 15);
    assertSeq(m.whileIn(c, "locked"), [1, 2], done);
  });

  it("until() propagates values only until FSM state reaches a target", (done) => {
    const m = turnstile((i) => true);
    const c = erx.bus();
    setTimeout(() => c.push(1), 5);
    setTimeout(() => { c.push(2); m.send("coin"); }, 10);
    setTimeout(() => { c.push(3); c.close(); }, 15);
    assertSeq(m.until(c, ["open"]), [1, 2], done);
  });
});
