package stratum

import (
	"testing"
)

func TestNextIDIncrements(t *testing.T) {
	c := NewClient("localhost", 3333)
	if a, b := c.nextID(), c.nextID(); a != 1 || b != 2 {
		t.Fatalf("nextID sequence = %d,%d want 1,2", a, b)
	}
}

// TestSubscribeResponseMatchedByID ensures the subscribe response is parsed by
// matching its request ID (not a hardcoded 1), which is what makes reconnects work.
func TestSubscribeResponseMatchedByID(t *testing.T) {
	c := NewClient("localhost", 3333)

	var gotEx1 string
	var gotEx2Size int
	c.SetSubscribedCallback(func(ex1 string, ex2Size int) {
		gotEx1 = ex1
		gotEx2Size = ex2Size
	})

	// Simulate that subscribe was sent with an arbitrary (non-1) request ID,
	// as would happen after a reconnect.
	c.subscribeID = 7

	resp := []byte(`{"id":7,"result":[[["mining.notify","abc"]],"f8002a00",4],"error":null}`)
	c.handleMessage(resp)

	if gotEx1 != "f8002a00" {
		t.Fatalf("extranonce1 = %q, want f8002a00", gotEx1)
	}
	if gotEx2Size != 4 {
		t.Fatalf("extranonce2Size = %d, want 4", gotEx2Size)
	}
	if !c.subscribed {
		t.Fatalf("client should be marked subscribed")
	}
}

func TestAuthorizeResponseMatchedByID(t *testing.T) {
	c := NewClient("localhost", 3333)
	c.authorizeID = 12

	c.handleMessage([]byte(`{"id":12,"result":true,"error":null}`))
	if !c.IsAuthorized() {
		t.Fatalf("client should be authorized")
	}
}

func TestSetDifficultyNotification(t *testing.T) {
	c := NewClient("localhost", 3333)

	var got float64
	c.SetDifficultyCallback(func(d float64) { got = d })

	c.handleMessage([]byte(`{"id":null,"method":"mining.set_difficulty","params":[0.001]}`))

	if got != 0.001 {
		t.Fatalf("difficulty callback got %v, want 0.001", got)
	}
	if c.GetDifficulty() != 0.001 {
		t.Fatalf("GetDifficulty = %v, want 0.001", c.GetDifficulty())
	}
}

func TestSetDifficultyIgnoresInvalid(t *testing.T) {
	c := NewClient("localhost", 3333) // defaults to difficulty 1
	c.handleMessage([]byte(`{"id":null,"method":"mining.set_difficulty","params":[0]}`))
	if c.GetDifficulty() != 1 {
		t.Fatalf("difficulty should be unchanged on a zero update, got %v", c.GetDifficulty())
	}
}

func TestMiningNotifyParsesJob(t *testing.T) {
	c := NewClient("localhost", 3333)

	var job *Job
	c.SetJobCallback(func(j *Job) { job = j })

	msg := []byte(`{"id":null,"method":"mining.notify","params":["jobid","prev","cb1","cb2",["m1","m2"],"20000000","1d00ffff","5f000000",true]}`)
	c.handleMessage(msg)

	if job == nil {
		t.Fatal("expected a job from mining.notify")
	}
	if job.ID != "jobid" || job.NBits != "1d00ffff" || !job.CleanJobs {
		t.Fatalf("unexpected job: %+v", job)
	}
	if len(job.MerkleBranch) != 2 {
		t.Fatalf("expected 2 merkle branches, got %d", len(job.MerkleBranch))
	}
}

// TestCloseIsIdempotent guards against the double channel-close panic.
func TestCloseIsIdempotent(t *testing.T) {
	c := NewClient("localhost", 3333)
	if err := c.Close(); err != nil {
		t.Fatalf("first Close: %v", err)
	}
	// Must not panic on a second call.
	if err := c.Close(); err != nil {
		t.Fatalf("second Close: %v", err)
	}
}

func TestErrorResponseIgnored(t *testing.T) {
	c := NewClient("localhost", 3333)
	c.authorizeID = 2
	// An error response must not flip the authorized flag.
	c.handleMessage([]byte(`{"id":2,"result":null,"error":[21,"Job not found",null]}`))
	if c.IsAuthorized() {
		t.Fatalf("client should not be authorized after an error response")
	}
}
