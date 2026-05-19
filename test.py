def summation(num: list[int], target: int):
  seen = {}
  for i, num in enumerate(num):
      complement = target - num
      if complement in seen:
          return [seen[complement], i]
      seen[num] = i


summation([6, 4, 5, 2, 7, 5, 2, 3, 9, 3], 8)


def twoSum(nums: list[int], target: int) -> list[int]:
    seen = {}  # value -> index

    for i, num in enumerate(nums): # Enumerate helps us to get the position and number sitting at that position.
        complement = target - num   # what we NEED to find

        if complement in seen:      # already encountered it earlier?
            return [seen[complement], i]

        seen[num] = i               # store current number for future lookups