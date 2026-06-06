import { describe, expect, it } from "vitest";
import { createAliyunFunAsrMessageMapper } from "./aliyun-funasr-message-mapper";

describe("createAliyunFunAsrMessageMapper", () => {
  it("maps partial result-generated events into non-final segment updates", () => {
    const mapper = createAliyunFunAsrMessageMapper();

    const updates = mapper.map({
      header: {
        task_id: "task-1",
        event: "result-generated"
      },
      payload: {
        output: {
          sentence: {
            sentence_id: 3,
            text: "hello world",
            begin_time: 120,
            end_time: 680,
            sentence_end: false,
            heartbeat: false
          }
        }
      }
    });

    expect(updates).toEqual([
      {
        continuityKey: "aliyun:task-1:sentence:3",
        text: "hello world",
        isFinal: false,
        startMs: 120,
        endMs: 680,
        sequence: 1,
        revision: 0
      }
    ]);
  });

  it("keeps the same continuity key and increments revision across partial to final updates", () => {
    const mapper = createAliyunFunAsrMessageMapper();

    const first = mapper.map({
      header: {
        task_id: "task-2",
        event: "result-generated"
      },
      payload: {
        output: {
          sentence: {
            sentence_id: 7,
            text: "small language",
            begin_time: 0,
            end_time: 500,
            sentence_end: false,
            heartbeat: false
          }
        }
      }
    });
    const second = mapper.map({
      header: {
        task_id: "task-2",
        event: "result-generated"
      },
      payload: {
        output: {
          sentence: {
            sentence_id: 7,
            text: "small language models",
            begin_time: 0,
            end_time: 900,
            sentence_end: true,
            heartbeat: false
          }
        }
      }
    });

    expect(first[0]).toMatchObject({
      continuityKey: "aliyun:task-2:sentence:7",
      revision: 0,
      isFinal: false
    });
    expect(second[0]).toMatchObject({
      continuityKey: "aliyun:task-2:sentence:7",
      revision: 1,
      isFinal: true
    });
  });

  it("ignores heartbeat and non-result events", () => {
    const mapper = createAliyunFunAsrMessageMapper();

    expect(
      mapper.map({
        header: {
          task_id: "task-3",
          event: "task-started"
        },
        payload: {}
      })
    ).toEqual([]);

    expect(
      mapper.map({
        header: {
          task_id: "task-3",
          event: "result-generated"
        },
        payload: {
          output: {
            sentence: {
              sentence_id: 0,
              text: "",
              heartbeat: true,
              sentence_end: false
            }
          }
        }
      })
    ).toEqual([]);
  });
});
