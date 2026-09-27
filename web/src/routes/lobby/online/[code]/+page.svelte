<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  

  let status = $state("Disconnected");
  let lastMessage = $state("");

  onMount(() => {
    const socket = new WebSocket("ws://localhost:8080");

    socket.onopen = () => {
      console.log("Connected to server");
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

<h1>Room {data.room.code}</h1>
<p>Share this code with another player to open this lobby.</p>
<p>{data.room.numPlayers} player(s) per team ·
  {#if data.room.rules.kind === "time"}
    {data.room.rules.minutes} minutes
  {:else}
    First to {data.room.rules.target} goals
  {/if}
</p>


