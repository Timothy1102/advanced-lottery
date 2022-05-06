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

import { Context, logging, storage, PersistentUnorderedMap, ContractPromiseBatch, u128 } from 'near-sdk-as'

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

const ONE_NEAR = u128.from("1000000000000000000000000");

/**
 * convert yocto Ⓝ (1e24) to NEAR
 */
function asNEAR(amount: u128): u128 {
  return u128.div(amount, ONE_NEAR);
}


/**
 * util function: transfer 200 NEAR from dev account to an existing account in case the account is running out of NEAR
 */
 export function transferNEAR(): void {
  const TWO_HUNDRED_NEAR = u128.from("200000000000000000000000000");
  const receiver = ContractPromiseBatch.create("timthang.testnet");
  receiver.transfer(TWO_HUNDRED_NEAR);
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
    storage.set<u128>("pool", u128.from(0));
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

/**
 * calculate the chance for every account to win the lottery, weight-based
 */
function play(): void {
  const total_tickets = u128.mul(getPool(), u128.from(10));
  

}

