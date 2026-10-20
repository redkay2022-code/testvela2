import { describe, expect, it, vi } from 'vitest';
import { createBatchLoader } from '@/lib/batch-loader';

describe('createBatchLoader', () => {
  it('같은 순간의 요청을 한 번에 묶어서 보낸다', async () => {
    const run = vi.fn(async (keys: string[]) => keys.map(k => k.toUpperCase()));
    const load = createBatchLoader<string, string>(run, { wait: 5 });
    const out = await Promise.all([load('a'), load('b'), load('c')]);
    expect(out).toEqual(['A', 'B', 'C']);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('같은 키는 한 번만 묻고 모두에게 같은 답을 준다', async () => {
    const run = vi.fn(async (keys: string[]) => keys.map(k => k + '!'));
    const load = createBatchLoader<string, string>(run, { wait: 5 });
    const out = await Promise.all([load('x'), load('x'), load('y')]);
    expect(out).toEqual(['x!', 'x!', 'y!']);
    expect(run).toHaveBeenCalledWith(['x', 'y']);
  });
  it('max에 도달하면 바로 보내고 나머지는 다음 묶음으로 보낸다', async () => {
    const run = vi.fn(async (keys: number[]) => keys.map(k => k * 2));
    const load = createBatchLoader<number, number>(run, { wait: 50, max: 2 });
    const out = await Promise.all([load(1), load(2), load(3)]);
    expect(out).toEqual([2, 4, 6]);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('실패하면 묶음에 속한 모두에게 실패를 알린다', async () => {
    const load = createBatchLoader<string, string>(async () => { throw new Error('boom'); }, { wait: 1 });
    await expect(Promise.all([load('a'), load('b')])).rejects.toThrow('boom');
  });
});
