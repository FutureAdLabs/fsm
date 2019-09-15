import FSM from "../src"
import * as erx from "@adludio/erx"

import { expect } from "chai"

function asap(fn: (...args: any[]) => any) {
  setTimeout(fn, 1);
}

function assertSeq(c: erx.Stream<string>, expected: any[], done: () => void) {
  const acc = [];
  c.subscribe((v: any) => acc.push(v), null, () => {
    expect(acc).to.deep.equal(expected)
    done();
  });
}

const ts = (e: string, s: string, cb) => {
  return (m) => {
    cb(`${e}_${s}_from_${m.lastState || "nowhere"}`)
    return true
  }
}

function turnstile (cb: (f: string) => boolean) {
  const fsm = new FSM(
    {
      "open": {
        onEnter: ts("entering", "open", cb),
        onExit: ts("exiting", "open", cb),
      },
      "locked": {
        onEnter: ts("entering", "locked", cb),
        onExit: ts("exiting", "locked", cb),
      }
    },
    {
      "open": {
        "push": () => "locked",
        "coin": () => "open"
      },
      "locked": {
        "coin": () => "open"
      }
    }
  )

  fsm.goTo("locked")
  return fsm
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
      expect(changes).to.deep.equal([
        "entering_locked_from_nowhere",
        "exiting_locked_from_nowhere",
        "entering_open_from_locked",
        "exiting_open_from_locked",
        "entering_open_from_open",
        "exiting_open_from_open",
        "entering_locked_from_open"
      ]
      )
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
})

