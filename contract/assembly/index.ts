// Tim
import { Context, logging, storage, PersistentUnorderedMap, ContractPromiseBatch, u128, RNG, util } from 'near-sdk-as'

/**
 * Stores tickets balance for a list of accounts
 */
const ticketsBalance = new PersistentUnorderedMap<string, u128>("tb");

/**
 * represent one NEAR in yocto (1e24)
 */
const ONE_NEAR = u128.from("1000000000000000000000000");


/**
 * convert yocto Ⓝ (1e24) to NEAR
 */
function asNEAR(amount: u128): u128 {
  return u128.div(amount, ONE_NEAR);
}


/**
 * Must buy tickets to take part in the lottery.
 * To call the method: near call <contractName> buyTickets --amount=...
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
 * get total pool for the prize
 */
export function getPool(): u128 {
  const res = storage.getSome<u128>("pool");
  return res;
}

/**
 * get total tickets in all account
 */
export function getTotalTickets(): u32 {
  const total: string= u128.mul(getPool(), u128.from(10)).toString();
  const total_tickets: u32 = util.parseFromString<u32>(total);
  return total_tickets;
}

/**
 * return  the winner
 */
export function getWinner(): string {
  if (!storage.get<string>("winner") == null) {
    return storage.getSome<string>("winner");
  } else {
    return "NOBODY HAS WON";
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


/**
 * get info (total tikcets, total pool, tickets balance for each account)
 */
export function getInfo(): void {
  ticketsBalance.keys().forEach(account => {
    logging.log("account " + account + " has " + ticketsBalance.getSome(account).toString() + " tickets.")
  });
  const total_tickets = getTotalTickets();
  logging.log("TOTAL CIRCULATING TICKETS: " + total_tickets.toString());
  const pool = getPool();
  logging.log("CURRENT POOL: " + pool.toString() + " NEAR");
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
  logging.log("********************************************");
  logging.log("SENT " + asNEAR(reward_to_winner).toString() + " NEAR TO " + getWinner());
  logging.log("********************************************");
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
function stats(): u128[] {
  const array = new Array<u128>(4);
  array[3] = u128.from(0);
  const sorted_tickets_balance = ticketsBalance.values().sort();
  const total_tickets = getTotalTickets();
  const threshold = u128.from(total_tickets/20); //bottom 5% ticket will not be counted
  var a: u128 = u128.from(0);
  for(let i = 0; i < sorted_tickets_balance.length; i++) {
    if(a <= threshold) {
      a = u128.add(a, sorted_tickets_balance.shift());
      array[1] = a;
    }
  }
  array[0] = sorted_tickets_balance[0];
  for(let i = 0; i < sorted_tickets_balance.length; i++) {
    if(sorted_tickets_balance[i] == sorted_tickets_balance[(sorted_tickets_balance.length)-1]) {
      array[3] = u128.add(array[3], u128.from(1));
    }
  }
  array[2] = sorted_tickets_balance.pop();
  return array;
}


/**
 * determine the winner
 * weight-based (more tickets = more chance)
 */
export function play(): void {
  const account_list = ticketsBalance.keys();
  logging.log("THE LOTTERY CURRENTLY HAS : " + account_list.length.toString() + " PLAYERS");
  logging.log("TOTAL TICKETS = " + getTotalTickets().toString());
  logging.log("TOTAL POOL = " + getPool().toString());
  logging.log("+++++++++++++++++++++++++++++++++++++++++++++");

  account_list.forEach(account =>{
  const arr = stats();
  let bonus = util.parseFromString<u32>(arr[1].toString());  //bonus for the #1
  let top = util.parseFromString<u32>(arr[2].toString());  //highest balance 
  let number_of_top = util.parseFromString<u32>(arr[3].toString());  //number of #1 (in case multiple accounts have the same tickets)
    if(util.parseFromString<u32>(ticketsBalance.getSome(account).toString()) == top) {
      let bonus_for_this = bonus/number_of_top;
      logging.log("ACCOUNT " + account + " HAS " + bonus_for_this.toString() + " BONUS TICKETS (AS THE #1 TICKETS HOLDER)");
    }
  });
  logging.log("+++++++++++++++++++++++++++++++++++++++++++++++");

  account_list.forEach(account =>{
    const arr = stats();
    let threshold = util.parseFromString<u32>(arr[0].toString());  //anyone holding less than this value will not be able to take part in the lottery
      if(util.parseFromString<u32>(ticketsBalance.getSome(account).toString()) < threshold) {
        logging.log("ACCOUNT " + account + " WILL NOT BE ABLE TO TAKE PART IN THE LOTTERY DUE TO THE TICKETS BALANCE IS NOW ENOUGH");
      }
    });
    logging.log("+++++++++++++++++++++++++++++++++++++++++++++++");  

  while(storage.get<string>("winner") == null) {
    ticketsBalance.keys().forEach(account => {
      const arr = stats();
      let threshold = util.parseFromString<u32>(arr[0].toString());
      let bonus = util.parseFromString<u32>(arr[1].toString());
      let top = util.parseFromString<u32>(arr[2].toString());
      let number_of_top = util.parseFromString<u32>(arr[3].toString());

      let tickets: string = ticketsBalance.getSome(account).toString();
      let tickets_in_u32: u32 = util.parseFromString<u32>(tickets);

      if(!(tickets_in_u32 < threshold)) {
        const rng = new RNG<u32>(1, getTotalTickets());
        const roll = rng.next();
        // logging.log("roll: " + roll.toString());
        if(tickets_in_u32 == top) {
          // logging.log("VIP: + " + (bonus/number_of_top).toString() + " TICKETS");
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
  if (!storage.get<string>("winner") == null) {
    logging.log("=====================++++++++++================");
    logging.log("WINNER: " + storage.getSome<string>("winner"));
    logging.log("=====================++++++++++================");
  }
  sendReward();
}

