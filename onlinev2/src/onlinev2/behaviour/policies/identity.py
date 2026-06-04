from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from onlinev2.behaviour.protocol import AgentAction


@dataclass
class SingleAccountIdentity:
    """Single account identity: one user maps to one account."""
    def reset(self, seed: int) -> None:
        return None

    def map_user_action(
        self,
        *,
        user_id: str,
        participate: bool,
        report,
        deposit: float,
        meta: Dict[str, Any],
    ) -> List[AgentAction]:
        if not participate:
            return [AgentAction(account_id=user_id, participate=False, report=None, deposit=0.0, meta=dict(meta))]
        return [AgentAction(account_id=user_id, participate=True, report=report, deposit=float(deposit), meta=dict(meta))]


@dataclass
class SplitAccountIdentity:
    """Multi-account identity splitting: one logical participant maps to k accounts."""
    k: int = 3

    def reset(self, seed: int) -> None:
        return None

    def map_user_action(
        self,
        *,
        user_id: str,
        participate: bool,
        report,
        deposit: float,
        meta: Dict[str, Any],
    ) -> List[AgentAction]:
        if (not participate) or self.k <= 1 or deposit <= 0.0:
            return [
                AgentAction(
                    account_id=user_id,
                    participate=bool(participate),
                    report=report if participate else None,
                    deposit=float(deposit if participate else 0.0),
                    meta=dict(meta),
                )
            ]
        per = float(deposit) / float(self.k)
        out: List[AgentAction] = []
        for j in range(self.k):
            out.append(
                AgentAction(
                    account_id=f"{user_id}__linked_{j}",
                    participate=True,
                    report=report,
                    deposit=per,
                    meta={**dict(meta), "linked_parent_id": user_id, "linked_account_count": self.k},
                )
            )
        return out


@dataclass
class ReputationResetIdentity:
    """Reputation reset identity: creates new account id when resetting reputation."""
    counters: Dict[str, int] = field(default_factory=dict)

    def reset(self, seed: int) -> None:
        self.counters = {}

    def map_user_action(
        self,
        *,
        user_id: str,
        participate: bool,
        report,
        deposit: float,
        meta: Dict[str, Any],
    ) -> List[AgentAction]:
        count = self.counters.get(user_id, 0)
        if bool(meta.get("reputation_reset", False)):
            count += 1
        self.counters[user_id] = count
        account_id = f"{user_id}__reset_{count}" if count > 0 else user_id
        if not participate:
            return [AgentAction(account_id=account_id, participate=False, report=None, deposit=0.0, meta=dict(meta))]
        return [AgentAction(account_id=account_id, participate=True, report=report, deposit=float(deposit), meta=dict(meta))]


@dataclass
class CollusiveMultiAccountIdentity:
    """Collusive multi-account: k accounts share the same report and coordinate (for collusion experiments)."""
    k: int = 3

    def reset(self, seed: int) -> None:
        return None

    def map_user_action(
        self,
        *,
        user_id: str,
        participate: bool,
        report,
        deposit: float,
        meta: Dict[str, Any],
    ) -> List[AgentAction]:
        if (not participate) or self.k <= 1 or deposit <= 0.0:
            return [
                AgentAction(
                    account_id=user_id,
                    participate=bool(participate),
                    report=report if participate else None,
                    deposit=float(deposit if participate else 0.0),
                    meta={**dict(meta), "collusive": True},
                )
            ]
        per = float(deposit) / float(self.k)
        out: List[AgentAction] = []
        for j in range(self.k):
            out.append(
                AgentAction(
                    account_id=f"{user_id}__collusive_{j}",
                    participate=True,
                    report=report,
                    deposit=per,
                    meta={**dict(meta), "collusive": True, "collusive_parent": user_id},
                )
            )
        return out


@dataclass
class FakeActivityIdentity:
    """Fake activity identity: wash-style activity gaming with self-contained interaction patterns."""
    k: int = 2
    activity_boost: float = 0.3

    def reset(self, seed: int) -> None:
        return None

    def map_user_action(
        self,
        *,
        user_id: str,
        participate: bool,
        report,
        deposit: float,
        meta: Dict[str, Any],
    ) -> List[AgentAction]:
        if not participate or deposit <= 0.0:
            return [
                AgentAction(
                    account_id=user_id,
                    participate=bool(participate),
                    report=report if participate else None,
                    deposit=0.0,
                    meta={**dict(meta), "fake_activity": False},
                )
            ]
        split = max(1, self.k)
        per = float(deposit) / float(split)
        out: List[AgentAction] = []
        for j in range(split):
            out.append(
                AgentAction(
                    account_id=f"{user_id}__wash_{j}",
                    participate=True,
                    report=report,
                    deposit=per,
                    meta={**dict(meta), "fake_activity": True, "wash_parent": user_id},
                )
            )
        return out
