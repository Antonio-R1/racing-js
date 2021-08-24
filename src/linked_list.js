
class LinkedListNode {
   constructor (value, prev, next) {
      this.value = value;
      this.prev = prev;
      this.next = next;
   }
}

class LinkedList {

   constructor () {
      this.first = null;
      this.last = null;
      this.size = 0;
   }

   addFirst (value) {
      this.first = new LinkedListNode (value, null, this.first);
      if (this.last) {
         this.first.next.prev = this.first;
      }
      else {
         this.last = this.first;
      }
      this.size++;
      return this.first;
   }

   addLast (value) {
      this.last = new LinkedListNode (value, this.last, null);
      if (this.first) {
         this.last.prev.next = this.last;
      }
      else {
         this.first = this.last;
      }
      this.size++;
      return this.last;
   }

   addBeforeNode (node, value) {
      var newNode = new LinkedListNode (value, node.prev, node);
      if (node.prev) {
         node.prev.next = newNode;
         node.prev = newNode;
      }
      else {
         this.first = newNode;
         node.prev = newNode;
      }
      this.size++;
      return newNode;
   }

   addAfterNode (node, value) {
      var newNode = new LinkedListNode (value, node, node.next);
      if (node.next) {
         node.next.prev = newNode;
         node.next = newNode;
      }
      else {
         this.last = newNode;
         node.next = newNode;
      }
      this.size++;
      return newNode;
   }

   removeNode (node) {
      if (node.prev) {
         node.prev.next = node.next;
      }
      else {
         this.first = node.next;
      }

      if (node.next) {
         node.next.prev = node.prev;
      }
      else {
         this.last = node.prev;
      }
      this.size--;
   }

   removeFirst () {
      if (!this.first) {
         return false;
      }

      if (this.first.next) {
         this.first.next.prev = null;
      }
      else {
         this.last = null;
      }
      this.first = this.first.next;
      this.size--;

      return true;
   }

   removeLast () {
      if (!this.last) {
         return false;
      }

      if (this.last.prev) {
         this.last.prev.next = null;
      }
      else {
         this.first = null;
      }
      this.last = this.last.prev;
      this.size--;

      return true;
   }

}

export default LinkedList