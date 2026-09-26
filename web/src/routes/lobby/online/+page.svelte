<script lang="ts">
  import { onMount } from "svelte";

  let status = $state("Disconnected");
  let lastMessage = $state("");

  onMount(() => {
    const socket = new WebSocket("ws://localhost:8080");

    socket.onopen = () => {
      console.log("Connected to server");

      status = "Connected";

      socket.send("Testing");
    };

    socket.onmessage = (event) => {
      console.log("Message from server:", event.data);

      lastMessage = event.data;
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("Disconnected from server");

      status = "Disconnected";
    };

    return () => {
      socket.close();
    };
  });
</script>

<h1>Online Game</h1>


