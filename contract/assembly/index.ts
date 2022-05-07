/*
 * This is an example of an AssemblyScript smart contract with two simple,
 * symmetric functions:
 *
 * 1. setGreeting: accepts a greeting, such as "howdy", and records it for the
 *    user (account_id) who sent the request
 * 2. getGreeting: accepts an account_id and returns the greeting saved for it,
 *    defaulting to "Hello"
 *
 * Learn more about writing NEAR smart contracts with AssemblyScript:
 * https://docs.near.org/docs/develop/contracts/as/intro
 *
 */

import { Context, logging, storage, PersistentUnorderedMap, ContractPromiseBatch, u128, RNG, util } from 'near-sdk-as'

const DEFAULT_MESSAGE = 'Hello'

// Exported functions will be part of the public interface for your smart contract.
// Feel free to extract behavior to non-exported functions!
export function getGreeting(accountId: string): string | null {
  // This uses raw `storage.get`, a low-level way to interact with on-chain
  // storage for simple contracts.
  // If you have something more complex, check out persistent collections:
  // https://docs.near.org/docs/concepts/data-storage#assemblyscript-collection-types
  return storage.get<string>(accountId, DEFAULT_MESSAGE)
}

export function setGreeting(message: string): void {
  const accountId = Context.sender
  // Use logging.log to record logs permanently to the blockchain!
  logging.log(`Saving greeting "${message}" for account "${accountId}"`)
  storage.set(accountId, message)
}





// Tim : starts from here 

// import { context, storage, logging, PersistentMap } from "near-sdk-as";

/**
 * Stores tickets balance for a list of accounts
 */
const ticketsBalance = new PersistentUnorderedMap<string, u128>("tb");

/**
 * represent one NEAR in yocto (10e24)
 */
const ONE_NEAR = u128.from("1000000000000000000000000");


/**
 * convert yocto Ⓝ (1e24) to NEAR
 */
function asNEAR(amount: u128): u128 {
  return u128.div(amount, ONE_NEAR);
}


/**
 * Get tickets balance for an account
 */
export function getTicketsBalance(ticketOwner: string): u128 {
  logging.log("ticket balance of : " + ticketOwner);
  if (!ticketsBalance.contains(ticketOwner)) {
    return u128.from(0);
  }
  const result = ticketsBalance.getSome(ticketOwner);
  return result;
}

/**
 * To call the method: near call dev-1651844351853-23995106951924 buyTickets --amount=...
 * The "amount argument will be used to convert to tickets with the rate of 1 NEAR = 10 tickets"
 */
export function buyTickets(): void {
  assert(Context.attachedDeposit > u128.from(0), "attachedDeposit value must be greater than 0");
  const amount = asNEAR(Context.attachedDeposit);

  if(storage.getString("pool") == null) {
    storage.set<u128>("pool", amount);
  } else {
    let current_pool = storage.getSome<u128>("pool");
    storage.set<u128>("pool", u128.add(current_pool, amount));
  }

  const tickets = u128.mul(u128.from(10), amount);
  if(!ticketsBalance.contains(Context.sender)){
    ticketsBalance.set(Context.sender, tickets);
  } else {
    const current_tickets_balance = ticketsBalance.getSome(Context.sender);
    ticketsBalance.set(Context.sender, u128.add(tickets, current_tickets_balance));
  }
  logging.log("exchanging " + amount.toString() + " NEAR for " + tickets.toString() + " tickets.");
  logging.log("total tickets of " + Context.sender + " is: " + ticketsBalance.getSome(Context.sender).toString());
  logging.log("current prize pool: " + storage.getSome<u128>("pool").toString());
}

/**
 * get total pool for the prize
 */
export function getPool(): u128 {
  const res = storage.getSome<u128>("pool");
  return res;
}


export function getTotalTickets(): u32 {
  const total: string= u128.mul(getPool(), u128.from(10)).toString();
  const total_tickets: u32 = util.parseFromString<u32>(total);
  return total_tickets;
}


/**
 * calculate the chance for every account to win the lottery, weight-based
 * determine the winner
 */
export function play(): void {
  const account_list = ticketsBalance.keys();
  logging.log("THE LOTTERY CURRENTLY HAS : " + account_list.length.toString() + " PLAYERS");
  logging.log("TOTAL TICKETS = " + getTotalTickets().toString());
  logging.log("TOTAL POOL = " + getPool().toString());
  logging.log("+++++++++++++++++++++++++++++++++++++++++++++");

  while(storage.get<string>("winner") == null) {
    ticketsBalance.keys().forEach(account => {
      const arr = chance();
      let threshold = util.parseFromString<u32>(arr[0].toString());
      let bonus = util.parseFromString<u32>(arr[1].toString());
      let top = util.parseFromString<u32>(arr[2].toString());
      let number_of_top = util.parseFromString<u32>(arr[3].toString());

      let tickets: string = ticketsBalance.getSome(account).toString();
      let tickets_in_u32: u32 = util.parseFromString<u32>(tickets);

      logging.log(account + " has " + tickets + " tickets")

      if(!(tickets_in_u32 < threshold)) {
        const rng = new RNG<u32>(1, getTotalTickets());
        const roll = rng.next();
        // logging.log(account + " has " + tickets + " tickets...")
        logging.log("roll: " + roll.toString());
        if(tickets_in_u32 == top) {
          logging.log("VIP: + " + (bonus/number_of_top).toString() + " TICKETS");
          if(roll <= (tickets_in_u32 + bonus/number_of_top) ){
            if(storage.get<string>("winner") == null){
              storage.set("winner", account);
            }
          }
        } 
        else if(roll <= tickets_in_u32){
          if(storage.get<string>("winner") == null){
            storage.set("winner", account);
          }
        }
      }

    });
  }
  // get winner 
  if (!storage.get<string>("winner") == null) {
    logging.log("=====================++++++++++================");
    logging.log("WINNER: " + storage.getSome<string>("winner"));
    logging.log("=====================++++++++++================");
  }
}


/**
 * reset winner
 */
export function resetWinner(): void {
  storage.delete("winner");
}

/**
 * reset all
 */
 export function reset(): void {
  storage.delete("winner");
  storage.delete("pool");
  ticketsBalance.clear();
}


export function getWinner(): string {
  if (!storage.get<string>("winner") == null) {
    return storage.getSome<string>("winner");
  } else {
    return "NOBODY HAS WON";
  }
}


/**
 * send 95% pool to the winner, the host (contract account) keeps 5% pool.
 * reset the lottery.
 */
export function sendReward(): void {
  const receiver = ContractPromiseBatch.create(getWinner());
  const reward_pool: u128 = u128.mul(getPool(), ONE_NEAR);
  const reward_to_winner: u128 = u128.div(u128.mul(reward_pool, u128.from(95)), u128.from(100))
  receiver.transfer(reward_to_winner);
  reset();
}


/**
 * array[0]: if the tickets balance of an account is less than this value, that account will not take part in the lottery.
 * array[1]: total bonus (the top 5% lowest tickets balance) to the #1 account with highest tickets balance.
 * array[2]: current highest tickets balance accross all accounts.
 * array[3]: number of account with the same highest tickets balance (if any), the bonus will be splitted to those accounts.
 * 
 * note: in case there is no account with balance less than 5% total tickets, 
 * the account with lowest balance will be rejected to take part in the lottery and its balance will be the bonus.
 */
function chance(): u128[] {
  const array = new Array<u128>(4);
  array[3] = u128.from(0);
  const sorted_tickets_balance = ticketsBalance.values().sort();
  const total_tickets = getTotalTickets();
  const threshold = u128.from(total_tickets/20); //bottom 5% ticket will not be counted
  // logging.log("THRESHOLD = " + threshold.toString());
  var a: u128 = u128.from(0);
  for(let i = 0; i < sorted_tickets_balance.length; i++) {
    if(a <= threshold) {
      a = u128.add(a, sorted_tickets_balance.shift());
      array[1] = a;
    }
  }

  for(let i = 0; i < sorted_tickets_balance.length; i++) {
    if(sorted_tickets_balance[i] = sorted_tickets_balance[sorted_tickets_balance.length-1]) {
      array[3] = u128.add(array[3], u128.from(1));
    }
  }

  array[0] = sorted_tickets_balance[0];

  array[2] = sorted_tickets_balance.pop();
  return array;
}