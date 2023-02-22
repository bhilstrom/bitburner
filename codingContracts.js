import { settings, getItem, pp } from './common.js'
import { HammingDecode, HammingEncode } from './HammingCodeTools.js'
import { comprLZEncode, comprLZDecode } from './CompressionContracts';

// Taken from https://github.com/bitburner-official/bitburner-src/blob/dev/src/data/codingcontracttypes.ts

function convert2DArrayToString(arr) {
  var components = []
  arr.forEach(function (e) {
    var s = e.toString()
    s = ['[', s, ']'].join('')
    components.push(s)
  })
  return components.join(',').replace(/\s/g, '')
}

function removeBracketsFromArrayString(str) {
  let strCpy = str;
  if (strCpy.startsWith("[")) {
    strCpy = strCpy.slice(1);
  }
  if (strCpy.endsWith("]")) {
    strCpy = strCpy.slice(0, -1);
  }

  return strCpy;
}

function removeQuotesFromString(str) {
  let strCpy = str;
  if (strCpy.startsWith('"') || strCpy.startsWith("'")) {
    strCpy = strCpy.slice(1);
  }
  if (strCpy.endsWith('"') || strCpy.endsWith("'")) {
    strCpy = strCpy.slice(0, -1);
  }

  return strCpy;
}

const codingContractTypesMetadata = [
  {
    name: 'Find Largest Prime Factor',
    solver: function (data) {
      var fac = 2
      var n = data
      while (n > (fac - 1) * (fac - 1)) {
        while (n % fac === 0) {
          n = Math.round(n / fac)
        }
        ++fac
      }
      return n === 1 ? fac - 1 : n
    },
  },
  {
    name: 'Subarray with Maximum Sum',
    solver: function (data) {
      var nums = data.slice()
      for (var i = 1; i < nums.length; i++) {
        nums[i] = Math.max(nums[i], nums[i] + nums[i - 1])
      }
      return Math.max.apply(Math, nums)
    },
  },
  {
    name: 'Total Ways to Sum',
    solver: function (data) {
      var ways = [1]
      ways.length = data + 1
      ways.fill(0, 1)
      for (var i = 1; i < data; ++i) {
        for (var j = i; j <= data; ++j) {
          ways[j] += ways[j - i]
        }
      }
      return ways[data]
    },
  },
  {
    name: 'Total Ways to Sum II',
    solver: function (data) {
      // https://www.geeksforgeeks.org/coin-change-dp-7/?ref=lbp
      const n = data[0];
      const s = data[1];
      const ways = [1];
      ways.length = n + 1;
      ways.fill(0, 1);
      for (let i = 0; i < s.length; i++) {
        for (let j = s[i]; j <= n; j++) {
          ways[j] += ways[j - s[i]];
        }
      }
      return ways[n]
    },
  },
  {
    name: 'Spiralize Matrix',
    solver: function (data, ans) {
      var spiral = []
      var m = data.length
      var n = data[0].length
      var u = 0
      var d = m - 1
      var l = 0
      var r = n - 1
      var k = 0
      while (true) {
        // Up
        for (var col = l; col <= r; col++) {
          spiral[k] = data[u][col]
          ++k
        }
        if (++u > d) {
          break
        }
        // Right
        for (var row = u; row <= d; row++) {
          spiral[k] = data[row][r]
          ++k
        }
        if (--r < l) {
          break
        }
        // Down
        for (var col = r; col >= l; col--) {
          spiral[k] = data[d][col]
          ++k
        }
        if (--d < u) {
          break
        }
        // Left
        for (var row = d; row >= u; row--) {
          spiral[k] = data[row][l]
          ++k
        }
        if (++l > r) {
          break
        }
      }

      return spiral
    },
  },
  {
    name: 'Array Jumping Game',
    solver: function (data) {
      var n = data.length
      var i = 0
      for (var reach = 0; i < n && i <= reach; ++i) {
        reach = Math.max(i + data[i], reach)
      }
      var solution = i === n
      return solution ? 1 : 0
    },
  },
  {
    name: 'Array Jumping Game II',
    solver: function (data) {
      const n = data.length;
      let reach = 0;
      let jumps = 0;
      let lastJump = -1;
      while (reach < n - 1) {
        let jumpedFrom = -1;
        for (let i = reach; i > lastJump; i--) {
          if (i + data[i] > reach) {
            reach = i + data[i];
            jumpedFrom = i;
          }
        }
        if (jumpedFrom === -1) {
          jumps = 0;
          break;
        }
        lastJump = jumpedFrom;
        jumps++;
      }
      return jumps
    },
  },
  {
    name: 'Merge Overlapping Intervals',
    solver: function (data) {
      var intervals = data.slice()
      intervals.sort(function (a, b) {
        return a[0] - b[0]
      })
      var result = []
      var start = intervals[0][0]
      var end = intervals[0][1]
      for (var _i = 0, intervals_1 = intervals; _i < intervals_1.length; _i++) {
        var interval = intervals_1[_i]
        if (interval[0] <= end) {
          end = Math.max(end, interval[1])
        } else {
          result.push([start, end])
          start = interval[0]
          end = interval[1]
        }
      }
      result.push([start, end])
      var sanitizedResult = convert2DArrayToString(result)
      return sanitizedResult
    },
  },
  {
    name: 'Generate IP Addresses',
    solver: function (data, ans) {
      var ret = []
      for (var a = 1; a <= 3; ++a) {
        for (var b = 1; b <= 3; ++b) {
          for (var c = 1; c <= 3; ++c) {
            for (var d = 1; d <= 3; ++d) {
              if (a + b + c + d === data.length) {
                var A = parseInt(data.substring(0, a), 10)
                var B = parseInt(data.substring(a, a + b), 10)
                var C = parseInt(data.substring(a + b, a + b + c), 10)
                var D = parseInt(data.substring(a + b + c, a + b + c + d), 10)
                if (A <= 255 && B <= 255 && C <= 255 && D <= 255) {
                  var ip = [A.toString(), '.', B.toString(), '.', C.toString(), '.', D.toString()].join('')
                  if (ip.length === data.length + 3) {
                    ret.push(ip)
                  }
                }
              }
            }
          }
        }
      }
      return ret
    },
  },
  {
    name: 'Algorithmic Stock Trader I',
    solver: function (data) {
      var maxCur = 0
      var maxSoFar = 0
      for (var i = 1; i < data.length; ++i) {
        maxCur = Math.max(0, (maxCur += data[i] - data[i - 1]))
        maxSoFar = Math.max(maxCur, maxSoFar)
      }
      return maxSoFar.toString()
    },
  },
  {
    name: 'Algorithmic Stock Trader II',
    solver: function (data) {
      var profit = 0
      for (var p = 1; p < data.length; ++p) {
        profit += Math.max(data[p] - data[p - 1], 0)
      }
      return profit.toString()
    },
  },
  {
    name: 'Algorithmic Stock Trader III',
    solver: function (data) {
      var hold1 = Number.MIN_SAFE_INTEGER
      var hold2 = Number.MIN_SAFE_INTEGER
      var release1 = 0
      var release2 = 0
      for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
        var price = data_1[_i]
        release2 = Math.max(release2, hold2 + price)
        hold2 = Math.max(hold2, release1 - price)
        release1 = Math.max(release1, hold1 + price)
        hold1 = Math.max(hold1, price * -1)
      }
      return release2.toString()
    },
  },
  {
    name: 'Algorithmic Stock Trader IV',
    solver: function (data) {
      var k = data[0]
      var prices = data[1]
      var len = prices.length
      if (len < 2) {
        return 0
      }
      if (k > len / 2) {
        var res = 0
        for (var i = 1; i < len; ++i) {
          res += Math.max(prices[i] - prices[i - 1], 0)
        }
        return res
      }
      var hold = []
      var rele = []
      hold.length = k + 1
      rele.length = k + 1
      for (var i = 0; i <= k; ++i) {
        hold[i] = Number.MIN_SAFE_INTEGER
        rele[i] = 0
      }
      var cur
      for (var i = 0; i < len; ++i) {
        cur = prices[i]
        for (var j = k; j > 0; --j) {
          rele[j] = Math.max(rele[j], hold[j] + cur)
          hold[j] = Math.max(hold[j], rele[j - 1] - cur)
        }
      }
      return rele[k]
    },
  },
  {
    name: 'Minimum Path Sum in a Triangle',
    solver: function (data) {
      var n = data.length
      var dp = data[n - 1].slice()
      for (var i = n - 2; i > -1; --i) {
        for (var j = 0; j < data[i].length; ++j) {
          dp[j] = Math.min(dp[j], dp[j + 1]) + data[i][j]
        }
      }
      return dp[0]
    },
  },
  {
    name: 'Unique Paths in a Grid I',
    solver: function (data) {
      const n = data[0]; // Number of rows
      const m = data[1]; // Number of columns
      const currentRow = [];
      currentRow.length = n;

      for (let i = 0; i < n; i++) {
        currentRow[i] = 1;
      }
      for (let row = 1; row < m; row++) {
        for (let i = 1; i < n; i++) {
          currentRow[i] += currentRow[i - 1];
        }
      }

      return currentRow[n - 1];
    },
  },
  {
    name: 'Unique Paths in a Grid II',
    solver: function (data) {
      var obstacleGrid = []
      obstacleGrid.length = data.length
      for (var i = 0; i < obstacleGrid.length; ++i) {
        obstacleGrid[i] = data[i].slice()
      }
      for (var i = 0; i < obstacleGrid.length; i++) {
        for (var j = 0; j < obstacleGrid[0].length; j++) {
          if (obstacleGrid[i][j] == 1) {
            obstacleGrid[i][j] = 0
          } else if (i == 0 && j == 0) {
            obstacleGrid[0][0] = 1
          } else {
            obstacleGrid[i][j] = (i > 0 ? obstacleGrid[i - 1][j] : 0) + (j > 0 ? obstacleGrid[i][j - 1] : 0)
          }
        }
      }
      return obstacleGrid[obstacleGrid.length - 1][obstacleGrid[0].length - 1]
    },
  },
  {
    name: 'Shortest Path in a Grid',
    solver: function (data) {
      // From https://raw.githubusercontent.com/alainbryden/bitburner-scripts/main/Tasks/contractor.js.solver.js
      //slightly adapted and simplified to get rid of MinHeap usage, and construct a valid path from potential candidates   
      //MinHeap replaced by simple array acting as queue (breadth first search)  
      const width = data[0].length;
      const height = data.length;
      const dstY = height - 1;
      const dstX = width - 1;

      const distance = new Array(height);
      //const prev: [[number, number] | undefined][] = new Array(height);
      const queue = [];

      for (let y = 0; y < height; y++) {
        distance[y] = new Array(width).fill(Infinity);
        //prev[y] = new Array(width).fill(undefined) as [undefined];
      }

      function validPosition(y, x) {
        return y >= 0 && y < height && x >= 0 && x < width && data[y][x] == 0;
      }

      // List in-bounds and passable neighbors
      function* neighbors(y, x) {
        if (validPosition(y - 1, x)) yield [y - 1, x]; // Up
        if (validPosition(y + 1, x)) yield [y + 1, x]; // Down
        if (validPosition(y, x - 1)) yield [y, x - 1]; // Left
        if (validPosition(y, x + 1)) yield [y, x + 1]; // Right
      }

      // Prepare starting point
      distance[0][0] = 0;

      //## Original version
      // queue.push([0, 0], 0);
      // // Take next-nearest position and expand potential paths from there
      // while (queue.size > 0) {
      //   const [y, x] = queue.pop() as [number, number];
      //   for (const [yN, xN] of neighbors(y, x)) {
      //     const d = distance[y][x] + 1;
      //     if (d < distance[yN][xN]) {
      //       if (distance[yN][xN] == Infinity)
      //         // Not reached previously
      //         queue.push([yN, xN], d);
      //       // Found a shorter path
      //       else queue.changeWeight(([yQ, xQ]) => yQ == yN && xQ == xN, d);
      //       //prev[yN][xN] = [y, x];
      //       distance[yN][xN] = d;
      //     }
      //   }
      // }

      //Simplified version. d < distance[yN][xN] should never happen for BFS if d != infinity, so we skip changeweight and simplify implementation
      //algo always expands shortest path, distance != infinity means a <= lenght path reaches it, only remaining case to solve is infinity    
      queue.push([0, 0]);
      while (queue.length > 0) {
        const [y, x] = queue.shift()
        for (const [yN, xN] of neighbors(y, x)) {
          if (distance[yN][xN] == Infinity) {
            queue.push([yN, xN])
            distance[yN][xN] = distance[y][x] + 1
          }
        }
      }

      // No path at all?
      if (distance[dstY][dstX] == Infinity) return "";

      //trace a path back to start
      let path = ""
      let [yC, xC] = [dstY, dstX]
      while (xC != 0 || yC != 0) {
        const dist = distance[yC][xC];
        for (const [yF, xF] of neighbors(yC, xC)) {
          if (distance[yF][xF] == dist - 1) {
            path = (xC == xF ? (yC == yF + 1 ? "D" : "U") : (xC == xF + 1 ? "R" : "L")) + path;
            [yC, xC] = [yF, xF]
            break
          }
        }
      }

      return path;
    }
  },
  {
    name: 'Sanitize Parentheses in Expression',
    solver: function (data) {
      let expression = data

      if (expression.length === 0) return [''];

      /** @type {(x: string) => boolean} */
      function sanitary(value) {
        let open = 0;
        for (const char of value) {
          if (char === '(') open++;
          else if (char === ')') open--;
          if (open < 0) return false;
        }
        return open === 0;
      }

      /** @type {string[]} */
      const queue = [expression];
      const tested = new Set();
      tested.add(expression);
      let found = false;
      const solution = [];
      while (queue.length > 0) {
        // @ts-ignore
        expression = queue.shift();
        if (sanitary(expression)) {
          solution.push(expression);
          found = true;
        }
        if (found) continue;
        for (let i = 0; i < expression.length; i++) {
          if (expression.charAt(i) !== '(' && expression.charAt(i) !== ')')
            continue;
          const stripped = expression.slice(0, i) + expression.slice(i + 1);
          if (!tested.has(stripped)) {
            queue.push(stripped);
            tested.add(stripped);
          }
        }
      }
      return solution;
    }
  },
  {
    name: 'Find All Valid Math Expressions',
    solver: function (data) {
      var num = data[0]
      var target = data[1]
      function helper(res, path, num, target, pos, evaluated, multed) {
        if (pos === num.length) {
          if (target === evaluated) {
            res.push(path)
          }
          return
        }
        for (var i = pos; i < num.length; ++i) {
          if (i != pos && num[pos] == '0') {
            break
          }
          var cur = parseInt(num.substring(pos, i + 1))
          if (pos === 0) {
            helper(res, path + cur, num, target, i + 1, cur, cur)
          } else {
            helper(res, path + '+' + cur, num, target, i + 1, evaluated + cur, cur)
            helper(res, path + '-' + cur, num, target, i + 1, evaluated - cur, -cur)
            helper(res, path + '*' + cur, num, target, i + 1, evaluated - multed + multed * cur, multed * cur)
          }
        }
      }

      if (num == null || num.length === 0) {
        return []
      }
      var result = []
      helper(result, '', num, target, 0, 0, 0)
      return result
    },
  },
  {
    name: 'HammingCodes: Integer to Encoded Binary',
    solver: function (data) {
      if (typeof data !== "number") throw new Error("solver expected number");
      return HammingEncode(data);
    }
  },
  {
    name: 'HammingCodes: Encoded Binary to Integer',
    solver: function (data) {
      if (typeof data !== "string") throw new Error("solver expected string");
      return HammingDecode(data);
    }
  },
  {
    name: 'Proper 2-Coloring of a Graph',
    solver: function (data) {
      // convert from edges to nodes
      const nodes = new Array(data[0]).fill(0).map(() => [])
      for (const e of data[1]) {
        nodes[e[0]].push(e[1])
        nodes[e[1]].push(e[0])
      }
      // solution graph starts out undefined and fills in with 0s and 1s
      const solution = new Array(data[0]).fill(undefined)
      let oddCycleFound = false
      // recursive function for DFS
      const traverse = (index, color) => {
        if (oddCycleFound) {
          // leave immediately if an invalid cycle was found
          return
        }
        if (solution[index] === color) {
          // node was already hit and is correctly colored
          return
        }
        if (solution[index] === (color ^ 1)) {
          // node was already hit and is incorrectly colored: graph is uncolorable
          oddCycleFound = true
          return
        }
        solution[index] = color
        for (const n of nodes[index]) {
          traverse(n, color ^ 1)
        }
      }
      // repeat run for as long as undefined nodes are found, in case graph isn't fully connected
      while (!oddCycleFound && solution.some(e => e === undefined)) {
        traverse(solution.indexOf(undefined), 0)
      }
      if (oddCycleFound) return "[]"; // TODO: Bug #3755 in bitburner requires a string literal. Will this be fixed?
      return solution
    },
  },
  {
    name: 'Compression I: RLE Compression',
    solver: function (data) {
      return data.replace(/([\w])\1{0,8}/g, (group, chr) => group.length + chr)
    }
  },
  {
    name: 'Compression II: LZ Decompression',
    solver: function (data) {
      return comprLZDecode(data);
    }
  },
  {
    name: 'Compression III: LZ Compression',
    solver: function (data) {
      return comprLZEncode(data)
    }
  },
  {
    name: 'Encryption I: Caesar Cipher',
    solver: function (data) {
      // data = [plaintext, shift value]
      // build char array, shifting via map and join to final results
      const cipher = [...data[0]]
        .map((a) => (a === " " ? a : String.fromCharCode(((a.charCodeAt(0) - 65 - data[1] + 26) % 26) + 65)))
        .join("");
      return cipher;
    }
  },
  {
    name: 'Encryption II: Vigenère Cipher',
    solver: function (data) {
      // data = [plaintext, keyword]
      // build char array, shifting via map and corresponding keyword letter and join to final results
      const cipher = [...data[0]]
        .map((a, i) => {
          return a === " "
            ? a
            : String.fromCharCode(((a.charCodeAt(0) - 2 * 65 + data[1].charCodeAt(i % data[1].length)) % 26) + 65);
        })
        .join("");
      return cipher;
    }
  },
]

function findAnswer(contract) {
  let answer

  const codingContractSolution = codingContractTypesMetadata.find((codingContractTypeMetadata) => codingContractTypeMetadata.name === contract.type)

  if (codingContractSolution) {
    answer = codingContractSolution.solver(contract.data)
  } else {
    console.error('Unable to find answer for', contract)
  }

  return answer
}

export async function main(ns) {
  pp(ns, `Starting codingContracts.js`, true)

  let hostname = ns.getHostname()

  if (hostname !== 'home') {
    throw new Error('Run the script from home')
  }

  const serverMap = getItem(settings().keys.serverMap)
  const contractsDb = []

  Object.keys(serverMap.servers).forEach((hostname) => {
    const files = ns.ls(hostname)
    if (files && files.length) {
      const contracts = files.filter((file) => file.includes('.cct'))

      if (contracts.length) {
        contracts.forEach((contract) => {
          const contractData = {
            contract,
            hostname,
            type: ns.codingcontract.getContractType(contract, hostname),
            data: ns.codingcontract.getData(contract, hostname),
          }

          contractsDb.push(contractData)
        })
      }
    }
  })

  if (contractsDb.length) {
    for (let i = 0; i < contractsDb.length; i++) {
      const contract = contractsDb[i]
      const answer = findAnswer(contract)

      if (answer != null) {
        const solvingResult = ns.codingcontract.attempt(answer, contract.contract, contract.hostname, { returnReward: true })

        if (solvingResult) {
          pp(ns, `Solved ${contract.contract} on ${contract.hostname}. ${solvingResult}`, true)
        } else {
          pp(ns, `Wrong answer for ${contract.contract} on ${contract.hostname}`, true)
        }
      } else {
        pp(ns, `Unable to find the answer for: ${JSON.stringify(contract)}`, true)
      }

      await ns.sleep(100)
    }
  }

  pp(ns, "Done", true)
}
